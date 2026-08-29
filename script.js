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
// SAFE DOM HELPERS
// =====================================================

const $ = (id) => document.getElementById(id);

const addClick = (element, callback) => {
if (element) {
element.addEventListener("click", callback);
}
};

const setText = (element, value) => {
if (element) {
element.textContent = value;
}
};

const setDisplay = (element, value) => {
if (element) {
element.style.display = value;
}
};

// =====================================================
// ELEMENTS
// =====================================================

let modal = null;
let form = null;
let titleInput = null;
let dateInput = null;
let timeInput = null;
let descriptionInput = null;
let dateTimeFields = null;
let extraFields = null;
let plannerApp = null;
let appLoading = null;

// =====================================================
// INITIALIZE DOM
// =====================================================

document.addEventListener("DOMContentLoaded", () => {

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

// -------------------------------------------------
// IMPORTANT:
// Keep planner hidden until Firebase verifies auth.
// -------------------------------------------------

if (plannerApp) {
    plannerApp.style.display = "none";
}

if (appLoading) {
    appLoading.style.display = "flex";
}

setupEventListeners();
setupLogout();

});

// =====================================================
// AUTHENTICATION
// =====================================================

onAuthStateChanged(auth, (user) => {

console.log(
    "Authentication state:",
    user ? "SIGNED IN" : "NOT SIGNED IN"
);

// -------------------------------------------------
// USER IS NOT LOGGED IN
// -------------------------------------------------

if (!user) {

    currentUser = null;

    if (unsubscribeItems) {
        unsubscribeItems();
        unsubscribeItems = null;
    }

    // Keep planner hidden.
    if (plannerApp) {
        plannerApp.style.display = "none";
    }

    // Keep loading visible briefly while redirecting.
    if (appLoading) {
        appLoading.style.display = "flex";
    }

    // IMPORTANT:
    // replace() prevents the protected page
    // from remaining in browser history.
    window.location.replace("login.html");

    return;
}


// -------------------------------------------------
// USER IS LOGGED IN
// -------------------------------------------------

currentUser = user;

const emailElement = $("userEmail");

if (emailElement) {
    emailElement.textContent =
        user.email || "User";
}


// -------------------------------------------------
// NOW IT IS SAFE TO SHOW THE APP
// -------------------------------------------------

if (appLoading) {
    appLoading.style.display = "none";
}

if (plannerApp) {
    plannerApp.style.display = "block";
}


// -------------------------------------------------
// START FIRESTORE
// -------------------------------------------------

startRealtimeItemsListener();

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
// REAL-TIME FIRESTORE LISTENER
// =====================================================

function startRealtimeItemsListener() {

if (!currentUser) {
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

        if (
            error?.code ===
            "failed-precondition"
        ) {

            alert(
                "Firestore needs an index for this query. Check the Firebase Console."
            );

        } else {

            alert(
                "Unable to load your planner data. Please check your Firebase Firestore setup."
            );
        }
    }
);

}

// =====================================================
// EVENT LISTENERS
// =====================================================

function setupEventListeners() {

// TODAY

addClick(
    $("todayAction"),
    () => showSection("today")
);


// ADD MEETING

addClick(
    $("addMeetingAction"),
    () => openModal("meeting")
);


// ADD INTERVIEW

addClick(
    $("addInterviewAction"),
    () => openModal("interview")
);


// ADD NOTE

addClick(
    $("addNoteAction"),
    () => openModal("note")
);


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

addClick(
    $("closeModalBtn"),
    closeModal
);


// CANCEL

addClick(
    $("cancelBtn"),
    closeModal
);


// CLICK OUTSIDE MODAL

if (modal) {

    modal.addEventListener(
        "click",
        (event) => {

            if (
                event.target === modal
            ) {
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

function openModal(
type,
item = null
) {

if (!modal || !form) {

    console.error(
        "Planner modal/form is missing from HTML."
    );

    return;
}


currentType = type;

editingId =
    item
        ? item.id
        : null;


form.reset();


const modalTitle =
    $("modalTitle");

const modalDescription =
    $("modalDescription");

const modalIcon =
    $("modalIcon");


// =================================================
// MEETING
// =================================================

if (type === "meeting") {

    setText(
        modalTitle,
        item
            ? "Edit Meeting"
            : "Add Meeting"
    );

    setText(
        modalDescription,
        item
            ? "Update your meeting details."
            : "Add a new meeting."
    );

    setText(
        modalIcon,
        "📅"
    );


    setDisplay(
        dateTimeFields,
        "block"
    );


    if (extraFields) {

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
}


// =================================================
// INTERVIEW
// =================================================

else if (type === "interview") {

    setText(
        modalTitle,
        item
            ? "Edit Interview"
            : "Add Interview"
    );

    setText(
        modalDescription,
        item
            ? "Update your interview details."
            : "Add a new job interview."
    );

    setText(
        modalIcon,
        "💼"
    );


    setDisplay(
        dateTimeFields,
        "block"
    );


    if (extraFields) {

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
}


// =================================================
// NOTE
// =================================================

else {

    setText(
        modalTitle,
        item
            ? "Edit Note"
            : "Add Note"
    );

    setText(
        modalDescription,
        item
            ? "Update your note."
            : "Save an important note."
    );

    setText(
        modalIcon,
        "📝"
    );


    setDisplay(
        dateTimeFields,
        "none"
    );


    if (extraFields) {
        extraFields.innerHTML = "";
    }
}


// =================================================
// LOAD EXISTING ITEM
// =================================================

if (item) {

    if (titleInput) {

        titleInput.value =
            item.title || "";
    }


    if (descriptionInput) {

        descriptionInput.value =
            item.description || "";
    }


    if (type !== "note") {

        if (dateInput) {

            dateInput.value =
                item.date || "";
        }


        if (timeInput) {

            timeInput.value =
                item.time || "";
        }
    }


    // MEETING

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


    // INTERVIEW

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


modal.classList.add(
    "active"
);


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

modal.classList.remove(
    "active"
);

editingId = null;


if (form) {
    form.reset();
}

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


if (!titleInput) {

    alert(
        "The title field is missing."
    );

    return;
}


const title =
    titleInput.value.trim();


const description =
    descriptionInput
        ? descriptionInput.value.trim()
        : "";


// =================================================
// DATE/TIME REQUIRED
// =================================================

if (
    currentType !== "note" &&
    (
        !dateInput ||
        !timeInput ||
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
    form?.querySelector(
        ".save-btn"
    );


if (saveButton) {

    saveButton.disabled = true;

    saveButton.textContent =
        "Saving...";
}


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


        if (currentType !== "note") {

            updatedData.date =
                dateInput.value;

            updatedData.time =
                timeInput.value;

        } else {

            updatedData.date = "";
            updatedData.time = "";
        }


        // MEETING

        if (
            currentType === "meeting"
        ) {

            const location =
                $("location");

            const meetingLink =
                $("meetingLink");


            updatedData.location =
                location?.value?.trim() || "";

            updatedData.meetingLink =
                meetingLink?.value?.trim() || "";

            updatedData.company = "";
            updatedData.position = "";
        }


        // INTERVIEW

        if (
            currentType === "interview"
        ) {

            const company =
                $("company");

            const position =
                $("position");

            const meetingLink =
                $("meetingLink");


            updatedData.company =
                company?.value?.trim() || "";

            updatedData.position =
                position?.value?.trim() || "";

            updatedData.meetingLink =
                meetingLink?.value?.trim() || "";

            updatedData.location = "";
        }


        // NOTE

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


        // MEETING

        if (
            currentType === "meeting"
        ) {

            const location =
                $("location");

            const meetingLink =
                $("meetingLink");


            newItem.location =
                location?.value?.trim() || "";

            newItem.meetingLink =
                meetingLink?.value?.trim() || "";
        }


        // INTERVIEW

        if (
            currentType === "interview"
        ) {

            const company =
                $("company");

            const position =
                $("position");

            const meetingLink =
                $("meetingLink");


            newItem.company =
                company?.value?.trim() || "";

            newItem.position =
                position?.value?.trim() || "";

            newItem.meetingLink =
                meetingLink?.value?.trim() || "";
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

if (item.type === "note") {
    return false;
}


if (!item.date || !item.time) {
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

if (item.type === "note") {
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

function getMeetingLinkName(
url,
type
) {

const lower =
    String(url || "")
        .toLowerCase();


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
    document.createElement("div");


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
            ${escapeHTML(item.title)}
        </div>
    `;
}


// =================================================
// META
// =================================================

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

    console.warn(
        `Planner container #${containerId} was not found.`
    );

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
        (item) =>
            item.type === "meeting"
    );


const interviews =
    items.filter(
        (item) =>
            item.type === "interview"
    );


const notes =
    items.filter(
        (item) =>
            item.type === "note"
    );


const today =
    items.filter(
        (item) =>
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


// =================================================
// COUNTS
// =================================================

setText(
    $("todayCount"),
    today.length
);


setText(
    $("meetingCount"),
    meetings.length
);


setText(
    $("interviewCount"),
    interviews.length
);


setText(
    $("noteCount"),
    notes.length
);


// =================================================
// BADGES
// =================================================

setText(
    $("todayBadge"),
    today.length
);


setText(
    $("meetingsBadge"),
    meetings.length
);


setText(
    $("interviewsBadge"),
    interviews.length
);


setText(
    $("notesBadge"),
    notes.length
);


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
        (existingItem) =>
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
        (existingItem) =>
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
        (menu) => {

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