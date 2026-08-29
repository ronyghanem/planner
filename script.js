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
// DOM ELEMENTS
// =====================================================

let modal;
let form;
let titleInput;
let dateInput;
let timeInput;
let descriptionInput;
let dateTimeFields;
let extraFields;
let plannerApp;
let appLoading;


// =====================================================
// DOM HELPER
// =====================================================

const $ = (id) => document.getElementById(id);


// =====================================================
// START APPLICATION
// =====================================================

document.addEventListener("DOMContentLoaded", () => {

    console.log("=================================");
    console.log("MY PLANNER STARTING");
    console.log("=================================");

    // Get DOM elements
    modal = $("modal");
    form = $("itemForm");
    titleInput = $("title");
    dateInput = $("date");
    timeInput = $("time");
    descriptionInput = $("description");
    dateTimeFields = $("dateTimeFields");
    extraFields = $("extraFields");
    plannerApp = $("plannerApp");
    appLoading = $("appLoading");


    console.log("plannerApp:", plannerApp);
    console.log("appLoading:", appLoading);
    console.log("form:", form);


    // If plannerApp does not exist, stop
    if (!plannerApp) {
        console.error(
            "ERROR: #plannerApp was not found in HTML."
        );
        return;
    }


    // Hide planner while checking authentication
    plannerApp.style.display = "none";

    if (appLoading) {
        appLoading.style.display = "flex";
    }


    // Setup buttons
    setupEventListeners();
    setupLogout();


    // =================================================
    // START FIREBASE AUTH CHECK ONLY AFTER DOM EXISTS
    // =================================================

    onAuthStateChanged(auth, async (user) => {

        console.log("---------------------------------");
        console.log("Firebase Auth State Changed");
        console.log("User:", user);
        console.log("---------------------------------");


        // =============================================
        // NOT LOGGED IN
        // =============================================

        if (!user) {

            console.log("❌ No user logged in");

            currentUser = null;

            if (unsubscribeItems) {
                unsubscribeItems();
                unsubscribeItems = null;
            }


            // Redirect to login
            window.location.replace("login.html");

            return;
        }


        // =============================================
        // LOGGED IN
        // =============================================

        console.log("✅ USER IS LOGGED IN");
        console.log("Email:", user.email);
        console.log("UID:", user.uid);


        currentUser = user;


        // Show email
        const emailElement = $("userEmail");

        if (emailElement) {
            emailElement.textContent =
                user.email || "User";
        }


        // =============================================
        // SHOW PLANNER
        // =============================================

        if (appLoading) {
            appLoading.style.display = "none";
        }

        plannerApp.style.display = "block";


        console.log("✅ Planner is now visible");


        // =============================================
        // START FIRESTORE
        // =============================================

        startRealtimeItemsListener();

    });

});


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
// FIRESTORE LISTENER
// =====================================================

function startRealtimeItemsListener() {

    if (!currentUser) {
        console.warn(
            "Cannot start Firestore listener: no user."
        );

        return;
    }


    if (unsubscribeItems) {
        unsubscribeItems();
        unsubscribeItems = null;
    }


    const itemsCollection =
        getItemsCollection();


    if (!itemsCollection) {
        return;
    }


    const itemsQuery = query(
        itemsCollection,
        orderBy("createdAt", "desc")
    );


    unsubscribeItems = onSnapshot(
        itemsQuery,

        (snapshot) => {

            console.log(
                "Firestore items:",
                snapshot.size
            );


            items = snapshot.docs.map(
                (itemDocument) => ({
                    id: itemDocument.id,
                    ...itemDocument.data()
                })
            );


            renderAll();
        },

        (error) => {

            console.error(
                "Firestore listener error:",
                error
            );


            alert(
                "Unable to load planner data. Check Firebase Firestore rules and configuration."
            );
        }
    );
}


// =====================================================
// EVENT LISTENERS
// =====================================================

function setupEventListeners() {

    // TODAY
    const todayAction = $("todayAction");

    if (todayAction) {
        todayAction.addEventListener(
            "click",
            () => showSection("today")
        );
    }


    // ADD MEETING
    const addMeetingAction =
        $("addMeetingAction");

    if (addMeetingAction) {
        addMeetingAction.addEventListener(
            "click",
            () => openModal("meeting")
        );
    }


    // ADD INTERVIEW
    const addInterviewAction =
        $("addInterviewAction");

    if (addInterviewAction) {
        addInterviewAction.addEventListener(
            "click",
            () => openModal("interview")
        );
    }


    // ADD NOTE
    const addNoteAction =
        $("addNoteAction");

    if (addNoteAction) {
        addNoteAction.addEventListener(
            "click",
            () => openModal("note")
        );
    }


    // VIEW BUTTONS
    document
        .querySelectorAll(".view-btn")
        .forEach((button) => {

            button.addEventListener(
                "click",
                () => {

                    const section =
                        button.dataset.section;

                    if (section) {
                        showSection(section);
                    }
                }
            );

        });


    // FORM
    if (form) {

        form.addEventListener(
            "submit",
            handleFormSubmit
        );

    }


    // CLOSE MODAL
    const closeModalBtn =
        $("closeModalBtn");

    if (closeModalBtn) {

        closeModalBtn.addEventListener(
            "click",
            closeModal
        );

    }


    // CANCEL
    const cancelBtn =
        $("cancelBtn");

    if (cancelBtn) {

        cancelBtn.addEventListener(
            "click",
            closeModal
        );

    }


    // CLICK OUTSIDE MODAL
    if (modal) {

        modal.addEventListener(
            "click",
            (event) => {

                if (event.target === modal) {
                    closeModal();
                }

            }
        );

    }


    // ESCAPE
    document.addEventListener(
        "keydown",
        (event) => {

            if (event.key === "Escape") {
                closeModal();
                closeAllMenus();
            }

        }
    );


    // CLOSE MENUS
    document.addEventListener(
        "click",
        (event) => {

            const target = event.target;

            if (
                target instanceof Element &&
                !target.closest(".item-menu")
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
        $("logoutButton");


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

                console.error(
                    "Logout error:",
                    error
                );

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

        today: $("todaySection"),

        meetings:
            $("meetingsSection"),

        interviews:
            $("interviewsSection"),

        notes:
            $("notesSection")

    };


    document
        .querySelectorAll(
            ".planner-section"
        )
        .forEach((element) => {

            element.classList.add(
                "hidden-section"
            );

        });


    document
        .querySelectorAll(".view-btn")
        .forEach((button) => {

            button.classList.remove(
                "active"
            );

        });


    const selectedSection =
        sections[section];


    if (selectedSection) {

        selectedSection.classList.remove(
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

function openModal(type, item = null) {

    if (!modal || !form) {
        console.error(
            "Modal or form missing."
        );

        return;
    }


    currentType = type;

    editingId =
        item ? item.id : null;


    form.reset();


    const modalTitle =
        $("modalTitle");

    const modalDescription =
        $("modalDescription");

    const modalIcon =
        $("modalIcon");


    // =============================================
    // MEETING
    // =============================================

    if (type === "meeting") {

        modalTitle.textContent =
            item
                ? "Edit Meeting"
                : "Add Meeting";


        modalDescription.textContent =
            item
                ? "Update your meeting details."
                : "Add a new meeting.";


        modalIcon.textContent = "📅";


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


    // =============================================
    // INTERVIEW
    // =============================================

    else if (type === "interview") {

        modalTitle.textContent =
            item
                ? "Edit Interview"
                : "Add Interview";


        modalDescription.textContent =
            item
                ? "Update your interview details."
                : "Add a new job interview.";


        modalIcon.textContent = "💼";


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


    // =============================================
    // NOTE
    // =============================================

    else {

        modalTitle.textContent =
            item
                ? "Edit Note"
                : "Add Note";


        modalDescription.textContent =
            item
                ? "Update your note."
                : "Save an important note.";


        modalIcon.textContent = "📝";


        dateTimeFields.style.display =
            "none";


        extraFields.innerHTML = "";
    }


    // =============================================
    // LOAD EXISTING ITEM
    // =============================================

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
                $("location");

            const meetingLink =
                $("meetingLink");


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
                $("company");

            const position =
                $("position");

            const meetingLink =
                $("meetingLink");


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


    modal.classList.add("active");


    setTimeout(() => {

        if (titleInput) {
            titleInput.focus();
        }

    }, 100);
}


// =====================================================
// CLOSE MODAL
// =====================================================

function closeModal() {

    if (!modal) {
        return;
    }


    modal.classList.remove("active");

    editingId = null;


    if (form) {
        form.reset();
    }
}


// =====================================================
// FORM SUBMIT
// =====================================================

async function handleFormSubmit(event) {

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
        descriptionInput
            ? descriptionInput.value.trim()
            : "";


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
        form.querySelector(".save-btn");


    if (saveButton) {

        saveButton.disabled = true;
        saveButton.textContent =
            "Saving...";

    }


    try {

        // =========================================
        // UPDATE
        // =========================================

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
                    serverTimestamp(),

                date:
                    currentType === "note"
                        ? ""
                        : dateInput.value,

                time:
                    currentType === "note"
                        ? ""
                        : timeInput.value

            };


            if (currentType === "meeting") {

                updatedData.location =
                    $("location")?.value.trim() || "";

                updatedData.meetingLink =
                    $("meetingLink")?.value.trim() || "";

                updatedData.company = "";
                updatedData.position = "";

            }


            if (currentType === "interview") {

                updatedData.company =
                    $("company")?.value.trim() || "";

                updatedData.position =
                    $("position")?.value.trim() || "";

                updatedData.meetingLink =
                    $("meetingLink")?.value.trim() || "";

                updatedData.location = "";

            }


            if (currentType === "note") {

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


        // =========================================
        // CREATE
        // =========================================

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


            if (currentType === "meeting") {

                newItem.location =
                    $("location")?.value.trim() || "";

                newItem.meetingLink =
                    $("meetingLink")?.value.trim() || "";

            }


            if (currentType === "interview") {

                newItem.company =
                    $("company")?.value.trim() || "";

                newItem.position =
                    $("position")?.value.trim() || "";

                newItem.meetingLink =
                    $("meetingLink")?.value.trim() || "";

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
            "Unable to save this item. Check Firebase Firestore."
        );

    } finally {

        if (saveButton) {

            saveButton.disabled = false;

            saveButton.textContent =
                "Save";

        }

    }
}


// =====================================================
// CHECK FINISHED
// =====================================================

function isFinished(item) {

    if (
        item.type === "note" ||
        !item.date ||
        !item.time
    ) {
        return false;
    }


    const scheduled =
        new Date(
            `${item.date}T${item.time}`
        );


    if (
        Number.isNaN(
            scheduled.getTime()
        )
    ) {
        return false;
    }


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
        item.type === "note" ||
        !item.date
    ) {
        return false;
    }


    const now = new Date();


    const year =
        now.getFullYear();


    const month =
        String(
            now.getMonth() + 1
        ).padStart(2, "0");


    const day =
        String(
            now.getDate()
        ).padStart(2, "0");


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


    if (
        Number.isNaN(
            object.getTime()
        )
    ) {
        return date;
    }


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


    const parts =
        time.split(":");


    const hours =
        Number(parts[0]);


    const minutes =
        Number(parts[1]);


    if (
        Number.isNaN(hours) ||
        Number.isNaN(minutes)
    ) {
        return time;
    }


    const object =
        new Date();


    object.setHours(
        hours,
        minutes,
        0,
        0
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

function getMeetingLinkName(url, type) {

    const lower =
        String(url || "").toLowerCase();


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
        lower.includes("webex.com")
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
        document.createElement("div");


    element.className =
        finished
            ? "item finished"
            : "item";


    let titleHTML = "";


    if (item.title) {

        titleHTML = `

            <div class="item-title">
                ${escapeHTML(item.title)}
            </div>

        `;
    }


    let metaHTML = "";


    if (item.type !== "note") {

        metaHTML += `

            <span>
                📅
                ${formatDate(item.date)}
            </span>

            <span>
                ⏰
                ${formatTime(item.time)}
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
                    <span>Edit</span>
                </button>


                <button
                    type="button"
                    class="delete-option"
                >
                    🗑️
                    <span>Delete</span>
                </button>

            </div>

        </div>

    `;


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


    if (dotsButton && menu) {

        dotsButton.addEventListener(
            "click",
            (event) => {

                event.preventDefault();
                event.stopPropagation();


                document
                    .querySelectorAll(
                        ".dropdown-menu.show"
                    )
                    .forEach(
                        (otherMenu) => {

                            if (
                                otherMenu !==
                                menu
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
    }


    if (editButton) {

        editButton.addEventListener(
            "click",
            (event) => {

                event.preventDefault();
                event.stopPropagation();

                closeAllMenus();

                editItem(item.id);

            }
        );

    }


    if (deleteButton) {

        deleteButton.addEventListener(
            "click",
            (event) => {

                event.preventDefault();
                event.stopPropagation();

                closeAllMenus();

                deleteItem(item.id);

            }
        );

    }


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
        $(containerId);


    const empty =
        $(emptyId);


    if (!container) {
        return;
    }


    container.innerHTML = "";


    data.forEach((item) => {

        container.appendChild(
            createItem(item)
        );

    });


    if (empty) {

        empty.style.display =
            data.length === 0
                ? "block"
                : "none";

    }
}


// =====================================================
// SORT
// =====================================================

function sortDateItems(data) {

    return [...data].sort(
        (a, b) => {

            const dateA =
                new Date(
                    `${a.date || "9999-12-31"}T${a.time || "23:59"}`
                );


            const dateB =
                new Date(
                    `${b.date || "9999-12-31"}T${b.time || "23:59"}`
                );


            return (
                dateA.getTime() -
                dateB.getTime()
            );

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
        sortDateItems(meetings);


    const sortedInterviews =
        sortDateItems(interviews);


    const sortedToday =
        sortDateItems(today);


    const sortedNotes =
        [...notes].sort(
            (a, b) => {

                const aTime =
                    a.createdAt?.seconds || 0;


                const bTime =
                    b.createdAt?.seconds || 0;


                return bTime - aTime;

            }
        );


    // COUNTS

    const todayCount =
        $("todayCount");

    if (todayCount) {
        todayCount.textContent =
            today.length;
    }


    const meetingCount =
        $("meetingCount");

    if (meetingCount) {
        meetingCount.textContent =
            meetings.length;
    }


    const interviewCount =
        $("interviewCount");

    if (interviewCount) {
        interviewCount.textContent =
            interviews.length;
    }


    const noteCount =
        $("noteCount");

    if (noteCount) {
        noteCount.textContent =
            notes.length;
    }


    // BADGES

    const todayBadge =
        $("todayBadge");

    if (todayBadge) {
        todayBadge.textContent =
            today.length;
    }


    const meetingsBadge =
        $("meetingsBadge");

    if (meetingsBadge) {
        meetingsBadge.textContent =
            meetings.length;
    }


    const interviewsBadge =
        $("interviewsBadge");

    if (interviewsBadge) {
        interviewsBadge.textContent =
            interviews.length;
    }


    const notesBadge =
        $("notesBadge");

    if (notesBadge) {
        notesBadge.textContent =
            notes.length;
    }


    // LISTS

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
// EDIT
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
// DELETE
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
        .forEach(
            menu => {

                menu.classList.remove(
                    "show"
                );

            }
        );
}


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHTML(value) {

    const div =
        document.createElement("div");


    div.textContent =
        String(value ?? "");


    return div.innerHTML;
}


// =====================================================
// ESCAPE ATTRIBUTE
// =====================================================

function escapeAttribute(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}


// =====================================================
// AUTOMATIC REFRESH
// =====================================================

setInterval(
    () => {

        if (currentUser) {
            renderAll();
        }

    },
    30000
);
