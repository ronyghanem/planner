import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    auth,
    db
} from "./firebase-config.js";


// =====================================================
// GLOBAL STATE
// =====================================================

let items = [];

let currentUser = null;

let currentType = "meeting";

let editingId = null;

let unsubscribeItems = null;


// =====================================================
// ELEMENTS
// =====================================================

const modal =
    document.getElementById("modal");

const form =
    document.getElementById("itemForm");

const titleInput =
    document.getElementById("title");

const dateInput =
    document.getElementById("date");

const timeInput =
    document.getElementById("time");

const descriptionInput =
    document.getElementById("description");

const dateTimeFields =
    document.getElementById("dateTimeFields");

const extraFields =
    document.getElementById("extraFields");

const plannerApp =
    document.getElementById("plannerApp");

const appLoading =
    document.getElementById("appLoading");


// =====================================================
// AUTHENTICATION GUARD
// =====================================================

onAuthStateChanged(
    auth,
    user => {

        if (!user) {

            if (unsubscribeItems) {
                unsubscribeItems();
                unsubscribeItems = null;
            }

            window.location.replace(
                "login.html"
            );

            return;
        }


        currentUser = user;


        const emailElement =
            document.getElementById(
                "userEmail"
            );

        if (emailElement) {

            emailElement.textContent =
                user.email || "User";

        }


        appLoading.style.display =
            "none";

        plannerApp.style.display =
            "block";


        startRealtimeItemsListener();
    }
);


// =====================================================
// FIRESTORE COLLECTION
// =====================================================

function getItemsCollection() {

    if (!currentUser) {
        return null;
    }

    return collection(
        db,
        "users",
        currentUser.uid,
        "plannerItems"
    );
}


// =====================================================
// REAL-TIME FIRESTORE LISTENER
// =====================================================

function startRealtimeItemsListener() {

    if (!currentUser) {
        return;
    }


    if (unsubscribeItems) {
        unsubscribeItems();
    }


    const itemsCollection =
        getItemsCollection();


    const itemsQuery =
        query(
            itemsCollection,
            orderBy("createdAt", "desc")
        );


    unsubscribeItems =
        onSnapshot(
            itemsQuery,
            snapshot => {

                items =
                    snapshot.docs.map(
                        itemDocument => ({
                            id:
                                itemDocument.id,

                            ...itemDocument.data()
                        })
                    );


                renderAll();
            },

            error => {

                console.error(
                    "Firestore listener error:",
                    error
                );

                alert(
                    "Unable to load your planner data. Please check your Firebase Firestore setup."
                );
            }
        );
}


// =====================================================
// INITIALIZE
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupEventListeners();

        setupLogout();

    }
);


// =====================================================
// EVENT LISTENERS
// =====================================================

function setupEventListeners() {

    // TODAY

    document
        .getElementById("todayAction")
        .addEventListener(
            "click",
            () => {
                showSection("today");
            }
        );


    // ADD MEETING

    document
        .getElementById("addMeetingAction")
        .addEventListener(
            "click",
            () => {
                openModal("meeting");
            }
        );


    // ADD INTERVIEW

    document
        .getElementById("addInterviewAction")
        .addEventListener(
            "click",
            () => {
                openModal("interview");
            }
        );


    // ADD NOTE

    document
        .getElementById("addNoteAction")
        .addEventListener(
            "click",
            () => {
                openModal("note");
            }
        );


    // VIEW BUTTONS

    document
        .querySelectorAll(".view-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    showSection(
                        button.dataset.section
                    );

                }
            );

        });


    // FORM

    form.addEventListener(
        "submit",
        handleFormSubmit
    );


    // CLOSE MODAL

    document
        .getElementById("closeModalBtn")
        .addEventListener(
            "click",
            closeModal
        );


    // CANCEL

    document
        .getElementById("cancelBtn")
        .addEventListener(
            "click",
            closeModal
        );


    // CLICK OUTSIDE MODAL

    modal.addEventListener(
        "click",
        event => {

            if (
                event.target === modal
            ) {

                closeModal();

            }

        }
    );


    // ESCAPE

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {

                closeModal();

                closeAllMenus();

            }

        }
    );


    // CLOSE MENUS

    document.addEventListener(
        "click",
        event => {

            if (
                !event.target.closest(
                    ".item-menu"
                )
            ) {

                closeAllMenus();

            }

        }
    );
}


// =====================================================
// LOGOUT
// =====================================================

function setupLogout() {

    const logoutButton =
        document.getElementById(
            "logoutButton"
        );


    if (!logoutButton) {
        return;
    }


    logoutButton.addEventListener(
        "click",
        async () => {

            const confirmed =
                confirm(
                    "Are you sure you want to logout?"
                );


            if (!confirmed) {
                return;
            }


            try {

                await signOut(auth);

                window.location.replace(
                    "login.html"
                );

            } catch (error) {

                console.error(error);

                alert(
                    "Unable to logout. Please try again."
                );

            }

        }
    );
}


// =====================================================
// SHOW SECTION
// =====================================================

function showSection(section) {

    const sections = {

        today:
            document.getElementById(
                "todaySection"
            ),

        meetings:
            document.getElementById(
                "meetingsSection"
            ),

        interviews:
            document.getElementById(
                "interviewsSection"
            ),

        notes:
            document.getElementById(
                "notesSection"
            )
    };


    document
        .querySelectorAll(
            ".planner-section"
        )
        .forEach(element => {

            element.classList.add(
                "hidden-section"
            );

        });


    document
        .querySelectorAll(
            ".view-btn"
        )
        .forEach(button => {

            button.classList.remove(
                "active"
            );

        });


    if (sections[section]) {

        sections[section]
            .classList.remove(
                "hidden-section"
            );

    }


    const activeButton =
        document.querySelector(
            `.view-btn[data-section="${section}"]`
        );


    if (activeButton) {

        activeButton.classList.add(
            "active"
        );

    }
}


// =====================================================
// OPEN MODAL
// =====================================================

function openModal(
    type,
    item = null
) {

    currentType = type;

    editingId =
        item
            ? item.id
            : null;


    form.reset();


    const modalTitle =
        document.getElementById(
            "modalTitle"
        );

    const modalDescription =
        document.getElementById(
            "modalDescription"
        );

    const modalIcon =
        document.getElementById(
            "modalIcon"
        );


    // =================================================
    // MEETING
    // =================================================

    if (type === "meeting") {

        modalTitle.textContent =
            item
                ? "Edit Meeting"
                : "Add Meeting";


        modalDescription.textContent =
            item
                ? "Update your meeting details."
                : "Add a new meeting.";


        modalIcon.textContent =
            "📅";


        dateTimeFields.style.display =
            "block";


        extraFields.innerHTML = `

            <div class="form-group">

                <label for="location">
                    Location
                    <span class="optional">
                        Optional
                    </span>
                </label>

                <input
                    type="text"
                    id="location"
                    placeholder="e.g. Beirut Office"
                >

            </div>


            <div class="form-group">

                <label for="meetingLink">
                    Meeting Link
                    <span class="optional">
                        Optional
                    </span>
                </label>

                <input
                    type="url"
                    id="meetingLink"
                    placeholder="https://zoom.us/..."
                >

            </div>

        `;
    }


    // =================================================
    // INTERVIEW
    // =================================================

    else if (type === "interview") {

        modalTitle.textContent =
            item
                ? "Edit Interview"
                : "Add Interview";


        modalDescription.textContent =
            item
                ? "Update your interview details."
                : "Add a new job interview.";


        modalIcon.textContent =
            "💼";


        dateTimeFields.style.display =
            "block";


        extraFields.innerHTML = `

            <div class="form-row">

                <div class="form-group">

                    <label for="company">
                        Company
                        <span class="optional">
                            Optional
                        </span>
                    </label>

                    <input
                        type="text"
                        id="company"
                        placeholder="Company name"
                    >

                </div>


                <div class="form-group">

                    <label for="position">
                        Position
                        <span class="optional">
                            Optional
                        </span>
                    </label>

                    <input
                        type="text"
                        id="position"
                        placeholder="Job title"
                    >

                </div>

            </div>


            <div class="form-group">

                <label for="meetingLink">
                    Interview Link
                    <span class="optional">
                        Optional
                    </span>
                </label>

                <input
                    type="url"
                    id="meetingLink"
                    placeholder="https://zoom.us/..."
                >

            </div>

        `;
    }


    // =================================================
    // NOTE
    // =================================================

    else {

        modalTitle.textContent =
            item
                ? "Edit Note"
                : "Add Note";


        modalDescription.textContent =
            item
                ? "Update your note."
                : "Save an important note.";


        modalIcon.textContent =
            "📝";


        dateTimeFields.style.display =
            "none";


        extraFields.innerHTML =
            "";
    }


    // =================================================
    // LOAD EXISTING ITEM
    // =================================================

    if (item) {

        titleInput.value =
            item.title || "";


        descriptionInput.value =
            item.description || "";


        if (type !== "note") {

            dateInput.value =
                item.date || "";


            timeInput.value =
                item.time || "";

        }


        if (type === "meeting") {

            const location =
                document.getElementById(
                    "location"
                );

            const meetingLink =
                document.getElementById(
                    "meetingLink"
                );


            if (location) {

                location.value =
                    item.location || "";

            }


            if (meetingLink) {

                meetingLink.value =
                    item.meetingLink || "";

            }

        }


        if (type === "interview") {

            const company =
                document.getElementById(
                    "company"
                );

            const position =
                document.getElementById(
                    "position"
                );

            const meetingLink =
                document.getElementById(
                    "meetingLink"
                );


            if (company) {

                company.value =
                    item.company || "";

            }


            if (position) {

                position.value =
                    item.position || "";

            }


            if (meetingLink) {

                meetingLink.value =
                    item.meetingLink || "";

            }

        }
    }


    modal.classList.add(
        "active"
    );


    setTimeout(
        () => {
            titleInput.focus();
        },
        100
    );
}


// =====================================================
// CLOSE MODAL
// =====================================================

function closeModal() {

    modal.classList.remove(
        "active"
    );

    editingId = null;

    form.reset();
}


// =====================================================
// FORM SUBMIT
// =====================================================

async function handleFormSubmit(
    event
) {

    event.preventDefault();


    if (!currentUser) {

        alert(
            "You must be logged in."
        );

        return;
    }


    const title =
        titleInput.value.trim();


    const description =
        descriptionInput.value.trim();


    // DATE/TIME REQUIRED FOR MEETING/INTERVIEW

    if (
        currentType !== "note" &&
        (
            !dateInput.value ||
            !timeInput.value
        )
    ) {

        alert(
            "Please select a date and time."
        );

        return;
    }


    const saveButton =
        form.querySelector(
            ".save-btn"
        );


    saveButton.disabled = true;

    saveButton.textContent =
        "Saving...";


    try {

        // =================================================
        // EDIT
        // =================================================

        if (editingId) {

            const itemRef =
                doc(
                    db,
                    "users",
                    currentUser.uid,
                    "plannerItems",
                    editingId
                );


            const updatedData = {

                title,

                description,

                type: currentType,

                updatedAt:
                    serverTimestamp()
            };


            if (
                currentType !== "note"
            ) {

                updatedData.date =
                    dateInput.value;

                updatedData.time =
                    timeInput.value;

            } else {

                updatedData.date = "";

                updatedData.time = "";

            }


            if (
                currentType === "meeting"
            ) {

                updatedData.location =
                    document
                        .getElementById(
                            "location"
                        )
                        ?.value
                        .trim() || "";


                updatedData.meetingLink =
                    document
                        .getElementById(
                            "meetingLink"
                        )
                        ?.value
                        .trim() || "";


                updatedData.company = "";

                updatedData.position = "";
            }


            if (
                currentType === "interview"
            ) {

                updatedData.company =
                    document
                        .getElementById(
                            "company"
                        )
                        ?.value
                        .trim() || "";


                updatedData.position =
                    document
                        .getElementById(
                            "position"
                        )
                        ?.value
                        .trim() || "";


                updatedData.meetingLink =
                    document
                        .getElementById(
                            "meetingLink"
                        )
                        ?.value
                        .trim() || "";


                updatedData.location = "";
            }


            if (
                currentType === "note"
            ) {

                updatedData.location = "";

                updatedData.company = "";

                updatedData.position = "";

                updatedData.meetingLink = "";

            }


            await updateDoc(
                itemRef,
                updatedData
            );

        }


        // =================================================
        // CREATE
        // =================================================

        else {

            const newItem = {

                type: currentType,

                title,

                description,

                date:
                    currentType === "note"
                        ? ""
                        : dateInput.value,

                time:
                    currentType === "note"
                        ? ""
                        : timeInput.value,

                location: "",

                company: "",

                position: "",

                meetingLink: "",

                createdAt:
                    serverTimestamp(),

                updatedAt:
                    serverTimestamp()
            };


            if (
                currentType === "meeting"
            ) {

                newItem.location =
                    document
                        .getElementById(
                            "location"
                        )
                        ?.value
                        .trim() || "";


                newItem.meetingLink =
                    document
                        .getElementById(
                            "meetingLink"
                        )
                        ?.value
                        .trim() || "";

            }


            if (
                currentType === "interview"
            ) {

                newItem.company =
                    document
                        .getElementById(
                            "company"
                        )
                        ?.value
                        .trim() || "";


                newItem.position =
                    document
                        .getElementById(
                            "position"
                        )
                        ?.value
                        .trim() || "";


                newItem.meetingLink =
                    document
                        .getElementById(
                            "meetingLink"
                        )
                        ?.value
                        .trim() || "";

            }


            await addDoc(
                getItemsCollection(),
                newItem
            );
        }


        closeModal();

    } catch (error) {

        console.error(
            "Save error:",
            error
        );


        alert(
            "Unable to save this item. Please check your Firebase Firestore setup."
        );

    } finally {

        saveButton.disabled =
            false;

        saveButton.textContent =
            "Save";

    }
}


// =====================================================
// CHECK FINISHED
// =====================================================

function isFinished(item) {

    if (
        item.type === "note"
    ) {

        return false;
    }


    if (
        !item.date ||
        !item.time
    ) {

        return false;
    }


    const scheduled =
        new Date(
            `${item.date}T${item.time}`
        );


    return (
        scheduled.getTime() <
        Date.now()
    );
}


// =====================================================
// CHECK TODAY
// =====================================================

function isToday(item) {

    if (
        item.type === "note"
    ) {

        return false;
    }


    if (!item.date) {

        return false;
    }


    const now =
        new Date();


    const year =
        now.getFullYear();


    const month =
        String(
            now.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            now.getDate()
        ).padStart(
            2,
            "0"
        );


    return (
        item.date ===
        `${year}-${month}-${day}`
    );
}


// =====================================================
// FORMAT DATE
// =====================================================

function formatDate(date) {

    if (!date) {
        return "";
    }


    const object =
        new Date(
            `${date}T00:00`
        );


    return object.toLocaleDateString(
        undefined,
        {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric"
        }
    );
}


// =====================================================
// FORMAT TIME
// =====================================================

function formatTime(time) {

    if (!time) {
        return "";
    }


    const [
        hours,
        minutes
    ] =
        time.split(":");


    const object =
        new Date();


    object.setHours(
        Number(hours)
    );


    object.setMinutes(
        Number(minutes)
    );


    return object.toLocaleTimeString(
        undefined,
        {
            hour: "numeric",
            minute: "2-digit"
        }
    );
}


// =====================================================
// MEETING LINK NAME
// =====================================================

function getMeetingLinkName(
    url,
    type
) {

    const lower =
        url.toLowerCase();


    if (
        lower.includes("zoom.us") ||
        lower.includes("zoom.com")
    ) {

        return "Join Zoom";
    }


    if (
        lower.includes(
            "teams.microsoft.com"
        ) ||
        lower.includes(
            "teams.live.com"
        )
    ) {

        return "Join Microsoft Teams";
    }


    if (
        lower.includes(
            "meet.google.com"
        )
    ) {

        return "Join Google Meet";
    }


    if (
        lower.includes(
            "webex.com"
        )
    ) {

        return "Join Webex";
    }


    return type === "interview"
        ? "Join Interview"
        : "Open Meeting";
}


// =====================================================
// CREATE ITEM
// =====================================================

function createItem(item) {

    const finished =
        isFinished(item);


    const element =
        document.createElement(
            "div"
        );


    element.className =
        finished
            ? "item finished"
            : "item";


    // =================================================
    // TITLE
    // =================================================

    let titleHTML = "";


    if (item.title) {

        titleHTML = `

            <div class="item-title">

                ${escapeHTML(
                    item.title
                )}

            </div>

        `;
    }


    // =================================================
    // META
    // =================================================

    let metaHTML = "";


    if (
        item.type !== "note"
    ) {

        metaHTML += `

            <span>
                📅
                ${formatDate(
                    item.date
                )}
            </span>

            <span>
                ⏰
                ${formatTime(
                    item.time
                )}
            </span>

        `;


        if (
            item.type === "meeting" &&
            item.location
        ) {

            metaHTML += `

                <span>
                    📍
                    ${escapeHTML(
                        item.location
                    )}
                </span>

            `;
        }


        if (
            item.type === "interview" &&
            item.company
        ) {

            metaHTML += `

                <span>
                    🏢
                    ${escapeHTML(
                        item.company
                    )}
                </span>

            `;
        }


        if (
            item.type === "interview" &&
            item.position
        ) {

            metaHTML += `

                <span>
                    💼
                    ${escapeHTML(
                        item.position
                    )}
                </span>

            `;
        }

    }


    const metaBlock =
        metaHTML
            ? `

                <div class="item-meta">

                    ${metaHTML}

                </div>

            `
            : "";


    // =================================================
    // DESCRIPTION
    // =================================================

    const descriptionHTML =
        item.description
            ? `

                <div class="item-description">

                    ${escapeHTML(
                        item.description
                    )}

                </div>

            `
            : "";


    // =================================================
    // LINK
    // =================================================

    let linkHTML = "";


    if (
        (
            item.type === "meeting" ||
            item.type === "interview"
        ) &&
        item.meetingLink
    ) {

        let safeURL =
            item.meetingLink.trim();


        if (
            !/^https?:\/\//i.test(
                safeURL
            )
        ) {

            safeURL =
                "https://" +
                safeURL;
        }


        linkHTML = `

            <a
                class="meeting-link"
                href="${escapeAttribute(
                    safeURL
                )}"
                target="_blank"
                rel="noopener noreferrer"
            >

                🔗

                ${getMeetingLinkName(
                    safeURL,
                    item.type
                )}

            </a>

        `;
    }


    // =================================================
    // ITEM HTML
    // =================================================

    element.innerHTML = `

        <div class="item-icon">

            ${
                item.type === "meeting"
                    ? "📅"
                    : item.type === "interview"
                        ? "💼"
                        : "📝"
            }

        </div>


        <div class="item-content">

            ${titleHTML}

            ${metaBlock}

            ${descriptionHTML}

            ${linkHTML}

        </div>


        <div class="item-menu">

            <button
                type="button"
                class="dots-btn"
                aria-label="More options"
            >
                ⋮
            </button>


            <div class="dropdown-menu">

                <button
                    type="button"
                    class="edit-option"
                >
                    ✏️
                    <span>
                        Edit
                    </span>
                </button>


                <button
                    type="button"
                    class="delete-option"
                >
                    🗑️
                    <span>
                        Delete
                    </span>
                </button>

            </div>

        </div>

    `;


    // =================================================
    // MENU EVENTS
    // =================================================

    const dotsButton =
        element.querySelector(
            ".dots-btn"
        );


    const menu =
        element.querySelector(
            ".dropdown-menu"
        );


    const editButton =
        element.querySelector(
            ".edit-option"
        );


    const deleteButton =
        element.querySelector(
            ".delete-option"
        );


    dotsButton.addEventListener(
        "click",
        event => {

            event.preventDefault();

            event.stopPropagation();


            document
                .querySelectorAll(
                    ".dropdown-menu.show"
                )
                .forEach(
                    otherMenu => {

                        if (
                            otherMenu !== menu
                        ) {

                            otherMenu.classList.remove(
                                "show"
                            );

                        }

                    }
                );


            menu.classList.toggle(
                "show"
            );

        }
    );


    editButton.addEventListener(
        "click",
        event => {

            event.preventDefault();

            event.stopPropagation();


            closeAllMenus();


            editItem(
                item.id
            );

        }
    );


    deleteButton.addEventListener(
        "click",
        event => {

            event.preventDefault();

            event.stopPropagation();


            closeAllMenus();


            deleteItem(
                item.id
            );

        }
    );


    return element;
}


// =====================================================
// RENDER LIST
// =====================================================

function renderList(
    containerId,
    emptyId,
    data
) {

    const container =
        document.getElementById(
            containerId
        );


    const empty =
        document.getElementById(
            emptyId
        );


    container.innerHTML =
        "";


    data.forEach(
        item => {

            container.appendChild(
                createItem(item)
            );

        }
    );


    empty.style.display =
        data.length === 0
            ? "block"
            : "none";
}


// =====================================================
// SORT
// =====================================================

function sortDateItems(data) {

    return [
        ...data
    ].sort(
        (a, b) => {

            const dateA =
                new Date(
                    `${a.date}T${a.time}`
                );


            const dateB =
                new Date(
                    `${b.date}T${b.time}`
                );


            return dateA - dateB;
        }
    );
}


// =====================================================
// RENDER ALL
// =====================================================

function renderAll() {

    const meetings =
        items.filter(
            item =>
                item.type === "meeting"
        );


    const interviews =
        items.filter(
            item =>
                item.type === "interview"
        );


    const notes =
        items.filter(
            item =>
                item.type === "note"
        );


    const today =
        items.filter(
            item =>
                isToday(item)
        );


    const sortedMeetings =
        sortDateItems(
            meetings
        );


    const sortedInterviews =
        sortDateItems(
            interviews
        );


    const sortedToday =
        sortDateItems(
            today
        );


    const sortedNotes =
        [...notes].sort(
            (a, b) => {

                const aTime =
                    a.createdAt?.seconds ||
                    0;

                const bTime =
                    b.createdAt?.seconds ||
                    0;

                return bTime - aTime;
            }
        );


    // =================================================
    // COUNTS
    // =================================================

    document.getElementById(
        "todayCount"
    ).textContent =
        today.length;


    document.getElementById(
        "meetingCount"
    ).textContent =
        meetings.length;


    document.getElementById(
        "interviewCount"
    ).textContent =
        interviews.length;


    document.getElementById(
        "noteCount"
    ).textContent =
        notes.length;


    // =================================================
    // BADGES
    // =================================================

    document.getElementById(
        "todayBadge"
    ).textContent =
        today.length;


    document.getElementById(
        "meetingsBadge"
    ).textContent =
        meetings.length;


    document.getElementById(
        "interviewsBadge"
    ).textContent =
        interviews.length;


    document.getElementById(
        "notesBadge"
    ).textContent =
        notes.length;


    // =================================================
    // LISTS
    // =================================================

    renderList(
        "todayList",
        "emptyToday",
        sortedToday
    );


    renderList(
        "meetingsList",
        "emptyMeetings",
        sortedMeetings
    );


    renderList(
        "interviewsList",
        "emptyInterviews",
        sortedInterviews
    );


    renderList(
        "notesList",
        "emptyNotes",
        sortedNotes
    );
}


// =====================================================
// EDIT ITEM
// =====================================================

function editItem(id) {

    const item =
        items.find(
            existingItem =>
                existingItem.id === id
        );


    if (!item) {
        return;
    }


    openModal(
        item.type,
        item
    );
}


// =====================================================
// DELETE ITEM
// =====================================================

async function deleteItem(id) {

    const item =
        items.find(
            existingItem =>
                existingItem.id === id
        );


    if (!item) {
        return;
    }


    const confirmed =
        confirm(
            "Are you sure you want to delete this item?"
        );


    if (!confirmed) {
        return;
    }


    if (!currentUser) {
        return;
    }


    try {

        await deleteDoc(
            doc(
                db,
                "users",
                currentUser.uid,
                "plannerItems",
                id
            )
        );

    } catch (error) {

        console.error(
            "Delete error:",
            error
        );


        alert(
            "Unable to delete this item."
        );
    }
}


// =====================================================
// CLOSE MENUS
// =====================================================

function closeAllMenus() {

    document
        .querySelectorAll(
            ".dropdown-menu.show"
        )
        .forEach(menu => {

            menu.classList.remove(
                "show"
            );

        });
}


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHTML(value) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        value;


    return div.innerHTML;
}


// =====================================================
// ESCAPE ATTRIBUTE
// =====================================================

function escapeAttribute(value) {

    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        );
}


// =====================================================
// AUTOMATIC FINISHED UPDATE
// =====================================================

setInterval(
    () => {

        if (currentUser) {
            renderAll();
        }

    },
    30000
);