// =====================================================
// MY PLANNER - OFFLINE FIRST
// =====================================================

import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp,
    getDocs,
    setDoc
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

let isOnline = navigator.onLine;

let syncing = false;


// =====================================================
// DOM
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
// LOCAL STORAGE KEYS
// =====================================================

function getStorageKey(uid) {
    return `planner_items_${uid}`;
}

function getPendingKey(uid) {
    return `planner_pending_${uid}`;
}

function getUserKey() {
    return "planner_last_user";
}


// =====================================================
// LOCAL DATA
// =====================================================

function loadLocalItems(uid) {

    if (!uid) {
        return [];
    }

    try {

        const saved =
            localStorage.getItem(
                getStorageKey(uid)
            );

        if (!saved) {
            return [];
        }

        const parsed =
            JSON.parse(saved);

        return Array.isArray(parsed)
            ? parsed
            : [];

    } catch (error) {

        console.error(
            "Local load error:",
            error
        );

        return [];
    }
}


// =====================================================
// SAVE LOCAL DATA
// =====================================================

function saveLocalItems(uid, data) {

    if (!uid) {
        return;
    }

    try {

        localStorage.setItem(
            getStorageKey(uid),
            JSON.stringify(data)
        );

    } catch (error) {

        console.error(
            "Local save error:",
            error
        );
    }
}


// =====================================================
// PENDING OPERATIONS
// =====================================================

function loadPendingOperations(uid) {

    if (!uid) {
        return [];
    }

    try {

        const saved =
            localStorage.getItem(
                getPendingKey(uid)
            );

        if (!saved) {
            return [];
        }

        const parsed =
            JSON.parse(saved);

        return Array.isArray(parsed)
            ? parsed
            : [];

    } catch (error) {

        console.error(
            "Pending load error:",
            error
        );

        return [];
    }
}


function savePendingOperations(uid, operations) {

    if (!uid) {
        return;
    }

    try {

        localStorage.setItem(
            getPendingKey(uid),
            JSON.stringify(operations)
        );

    } catch (error) {

        console.error(
            "Pending save error:",
            error
        );
    }
}


// =====================================================
// ADD PENDING OPERATION
// =====================================================

function addPendingOperation(operation) {

    if (!currentUser) {
        return;
    }

    const operations =
        loadPendingOperations(
            currentUser.uid
        );

    operations.push(operation);

    savePendingOperations(
        currentUser.uid,
        operations
    );
}


// =====================================================
// OFFLINE STATUS UI
// =====================================================

function updateOnlineStatus() {

    isOnline = navigator.onLine;

    let indicator =
        $("connectionStatus");

    if (!indicator) {

        indicator =
            document.createElement("div");

        indicator.id =
            "connectionStatus";

        indicator.className =
            "connection-status";

        document.body.appendChild(
            indicator
        );
    }


    if (isOnline) {

        indicator.textContent =
            "🟢 Online — Syncing data";

        indicator.classList.remove(
            "offline"
        );

        indicator.classList.add(
            "online"
        );

    } else {

        indicator.textContent =
            "🔴 Offline — Saved data available";

        indicator.classList.remove(
            "online"
        );

        indicator.classList.add(
            "offline"
        );
    }
}


// =====================================================
// ONLINE
// =====================================================

window.addEventListener(
    "online",
    async () => {

        console.log(
            "🌐 Internet connection restored"
        );

        updateOnlineStatus();

        if (currentUser) {

            await syncPendingOperations();

            startRealtimeItemsListener();
        }
    }
);


// =====================================================
// OFFLINE
// =====================================================

window.addEventListener(
    "offline",
    () => {

        console.log(
            "🔴 Internet connection lost"
        );

        updateOnlineStatus();

        renderAll();
    }
);


// =====================================================
// START APPLICATION
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "================================="
        );

        console.log(
            "MY PLANNER - OFFLINE FIRST"
        );

        console.log(
            "================================="
        );


        modal =
            $("modal");

        form =
            $("itemForm");

        titleInput =
            $("title");

        dateInput =
            $("date");

        timeInput =
            $("time");

        descriptionInput =
            $("description");

        dateTimeFields =
            $("dateTimeFields");

        extraFields =
            $("extraFields");

        plannerApp =
            $("plannerApp");

        appLoading =
            $("appLoading");


        if (!plannerApp) {

            console.error(
                "#plannerApp not found."
            );

            return;
        }


        plannerApp.style.display =
            "none";


        if (appLoading) {
            appLoading.style.display =
                "flex";
        }


        setupEventListeners();

        setupLogout();

        updateOnlineStatus();

        registerServiceWorker();


        // =========================================
        // FIREBASE AUTH
        // =========================================

        onAuthStateChanged(
            auth,
            async (user) => {

                console.log(
                    "Auth state:",
                    user
                );


                if (user) {

                    await initializeUser(
                        user
                    );

                    return;
                }


                // =================================
                // OFFLINE SESSION FALLBACK
                // =================================

                if (!navigator.onLine) {

                    const lastUser =
                        getLastUser();

                    if (lastUser) {

                        console.log(
                            "🔴 Using offline session"
                        );

                        currentUser =
                            lastUser;

                        initializeOfflineUser(
                            lastUser
                        );

                        return;
                    }
                }


                currentUser = null;


                if (unsubscribeItems) {

                    unsubscribeItems();

                    unsubscribeItems = null;
                }


                window.location.replace(
                    "login.html"
                );
            }
        );
    }
);


// =====================================================
// SAVE LAST USER
// =====================================================

function saveLastUser(user) {

    try {

        localStorage.setItem(
            getUserKey(),
            JSON.stringify({
                uid: user.uid,
                email: user.email || "User"
            })
        );

    } catch (error) {

        console.error(
            "Unable to save last user:",
            error
        );
    }
}


// =====================================================
// GET LAST USER
// =====================================================

function getLastUser() {

    try {

        const saved =
            localStorage.getItem(
                getUserKey()
            );

        if (!saved) {
            return null;
        }

        const user =
            JSON.parse(saved);

        if (!user.uid) {
            return null;
        }

        return user;

    } catch (error) {

        return null;
    }
}


// =====================================================
// INITIALIZE USER
// =====================================================

async function initializeUser(user) {

    currentUser = user;

    saveLastUser(user);


    const emailElement =
        $("userEmail");

    if (emailElement) {

        emailElement.textContent =
            user.email || "User";
    }


    // =============================================
    // LOAD LOCAL DATA FIRST
    // =============================================

    items =
        loadLocalItems(
            user.uid
        );


    showPlanner();

    renderAll();


    // =============================================
    // FIREBASE
    // =============================================

    if (navigator.onLine) {

        startRealtimeItemsListener();

        await syncPendingOperations();

    } else {

        console.log(
            "🔴 Offline - using local data"
        );
    }
}


// =====================================================
// OFFLINE USER
// =====================================================

function initializeOfflineUser(user) {

    const emailElement =
        $("userEmail");

    if (emailElement) {

        emailElement.textContent =
            user.email || "User";
    }


    items =
        loadLocalItems(
            user.uid
        );


    showPlanner();

    renderAll();
}


// =====================================================
// SHOW PLANNER
// =====================================================

function showPlanner() {

    if (appLoading) {

        appLoading.style.display =
            "none";
    }

    plannerApp.style.display =
        "block";
}


// =====================================================
// SERVICE WORKER
// =====================================================

function registerServiceWorker() {

    if (
        "serviceWorker" in navigator
    ) {

        window.addEventListener(
            "load",
            () => {

                navigator.serviceWorker
                    .register(
                        "/sw.js"
                    )
                    .then(() => {

                        console.log(
                            "✅ Service Worker registered"
                        );

                    })
                    .catch(error => {

                        console.error(
                            "Service Worker error:",
                            error
                        );
                    });
            }
        );
    }
}


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
        return;
    }

    if (!navigator.onLine) {
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


    const itemsQuery =
        query(
            itemsCollection,
            orderBy(
                "createdAt",
                "desc"
            )
        );


    unsubscribeItems =
        onSnapshot(

            itemsQuery,

            snapshot => {

                console.log(
                    "☁️ Firebase items:",
                    snapshot.size
                );


                const firebaseItems =
                    snapshot.docs.map(
                        itemDocument => ({
                            id:
                                itemDocument.id,
                            ...itemDocument.data()
                        })
                    );


                // =================================
                // MERGE FIREBASE WITH LOCAL
                // =================================

                const pending =
                    loadPendingOperations(
                        currentUser.uid
                    );


                const pendingIds =
                    new Set(
                        pending
                            .filter(
                                operation =>
                                    operation.item
                            )
                            .map(
                                operation =>
                                    operation.item.id
                            )
                    );


                const remoteItems =
                    firebaseItems.filter(
                        item =>
                            !pendingIds.has(
                                item.id
                            )
                    );


                const pendingLocalItems =
                    items.filter(
                        item =>
                            pendingIds.has(
                                item.id
                            )
                    );


                items = [
                    ...remoteItems,
                    ...pendingLocalItems
                ];


                saveLocalItems(
                    currentUser.uid,
                    items
                );


                renderAll();

                updateOnlineStatus();
            },

            error => {

                console.error(
                    "Firestore listener:",
                    error
                );

                // Do NOT hide planner.
                // Local data remains available.

                renderAll();
            }
        );
}


// =====================================================
// SYNC PENDING OPERATIONS
// =====================================================

async function syncPendingOperations() {

    if (
        !currentUser ||
        !navigator.onLine ||
        syncing
    ) {
        return;
    }


    const operations =
        loadPendingOperations(
            currentUser.uid
        );


    if (
        operations.length === 0
    ) {
        return;
    }


    syncing = true;


    console.log(
        "🔄 Syncing",
        operations.length,
        "offline operations..."
    );


    const remaining = [];


    for (
        const operation
        of operations
    ) {

        try {

            const item =
                operation.item;


            if (
                operation.action ===
                "create"
            ) {

                const itemRef =
                    doc(
                        db,
                        "users",
                        currentUser.uid,
                        "plannerItems",
                        item.id
                    );


                await setDoc(
                    itemRef,
                    {
                        ...item,
                        createdAt:
                            item.createdAt ||
                            serverTimestamp(),
                        updatedAt:
                            serverTimestamp()
                    }
                );
            }


            else if (
                operation.action ===
                "update"
            ) {

                const itemRef =
                    doc(
                        db,
                        "users",
                        currentUser.uid,
                        "plannerItems",
                        item.id
                    );


                await updateDoc(
                    itemRef,
                    {
                        ...item,
                        updatedAt:
                            serverTimestamp()
                    }
                );
            }


            else if (
                operation.action ===
                "delete"
            ) {

                const itemRef =
                    doc(
                        db,
                        "users",
                        currentUser.uid,
                        "plannerItems",
                        item.id
                    );


                await deleteDoc(
                    itemRef
                );
            }


            console.log(
                "✅ Synced:",
                operation.action,
                item.id
            );

        } catch (error) {

            console.error(
                "Sync operation failed:",
                error
            );


            remaining.push(
                operation
            );
        }
    }


    savePendingOperations(
        currentUser.uid,
        remaining
    );


    syncing = false;


    if (
        remaining.length === 0
    ) {

        console.log(
            "✅ Everything synchronized"
        );

        updateOnlineStatus();
    }
}


// =====================================================
// EVENT LISTENERS
// =====================================================

function setupEventListeners() {

    const todayAction =
        $("todayAction");

    if (todayAction) {

        todayAction.addEventListener(
            "click",
            () => showSection("today")
        );
    }


    const addMeetingAction =
        $("addMeetingAction");

    if (addMeetingAction) {

        addMeetingAction.addEventListener(
            "click",
            () => openModal("meeting")
        );
    }


    const addInterviewAction =
        $("addInterviewAction");

    if (addInterviewAction) {

        addInterviewAction.addEventListener(
            "click",
            () => openModal("interview")
        );
    }


    const addNoteAction =
        $("addNoteAction");

    if (addNoteAction) {

        addNoteAction.addEventListener(
            "click",
            () => openModal("note")
        );
    }


    document
        .querySelectorAll(".view-btn")
        .forEach(button => {

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


    if (form) {

        form.addEventListener(
            "submit",
            handleFormSubmit
        );
    }


    const closeModalBtn =
        $("closeModalBtn");

    if (closeModalBtn) {

        closeModalBtn.addEventListener(
            "click",
            closeModal
        );
    }


    const cancelBtn =
        $("cancelBtn");

    if (cancelBtn) {

        cancelBtn.addEventListener(
            "click",
            closeModal
        );
    }


    if (modal) {

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
    }


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


    document.addEventListener(
        "click",
        event => {

            const target =
                event.target;

            if (
                target instanceof Element &&
                !target.closest(
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

                currentUser = null;

                window.location.replace(
                    "login.html"
                );

            } catch (error) {

                console.error(
                    "Logout error:",
                    error
                );

                alert(
                    "Unable to logout."
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
            $("todaySection"),

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


    const selected =
        sections[section];


    if (selected) {

        selected.classList.remove(
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


        extraFields.innerHTML = "";
    }


    // =============================================
    // LOAD EXISTING
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

            $("location").value =
                item.location || "";

            $("meetingLink").value =
                item.meetingLink || "";
        }


        if (type === "interview") {

            $("company").value =
                item.company || "";

            $("position").value =
                item.position || "";

            $("meetingLink").value =
                item.meetingLink || "";
        }
    }


    modal.classList.add(
        "active"
    );


    setTimeout(
        () => {

            titleInput?.focus();

        },
        100
    );
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
// CREATE LOCAL ID
// =====================================================

function createLocalId() {

    if (
        window.crypto &&
        crypto.randomUUID
    ) {

        return crypto.randomUUID();
    }


    return (
        "local_" +
        Date.now() +
        "_" +
        Math.random()
            .toString(36)
            .substring(2)
    );
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


    if (!title) {

        alert(
            "Please enter a title."
        );

        return;
    }


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


    // =============================================
    // BUILD ITEM
    // =============================================

    const existingItem =
        editingId
            ? items.find(
                item =>
                    item.id === editingId
            )
            : null;


    const item = {

        id:
            editingId ||
            createLocalId(),

        type:
            currentType,

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

        location:
            "",

        company:
            "",

        position:
            "",

        meetingLink:
            "",

        createdAt:
            existingItem?.createdAt ||
            new Date().toISOString(),

        updatedAt:
            new Date().toISOString()
    };


    // =============================================
    // EXTRA DATA
    // =============================================

    if (
        currentType === "meeting"
    ) {

        item.location =
            $("location")
                ?.value
                .trim() || "";

        item.meetingLink =
            $("meetingLink")
                ?.value
                .trim() || "";
    }


    if (
        currentType === "interview"
    ) {

        item.company =
            $("company")
                ?.value
                .trim() || "";

        item.position =
            $("position")
                ?.value
                .trim() || "";

        item.meetingLink =
            $("meetingLink")
                ?.value
                .trim() || "";
    }


    // =============================================
    // SAVE LOCALLY FIRST
    // =============================================

    if (editingId) {

        items =
            items.map(
                existing =>
                    existing.id === editingId
                        ? item
                        : existing
            );

    } else {

        items.unshift(item);
    }


    saveLocalItems(
        currentUser.uid,
        items
    );


    // =============================================
    // IMMEDIATELY UPDATE UI
    // =============================================

    renderAll();

    closeModal();


    console.log(
        "💾 Saved locally:",
        item
    );


    // =============================================
    // FIREBASE
    // =============================================

    if (navigator.onLine) {

        try {

            const itemRef =
                doc(
                    db,
                    "users",
                    currentUser.uid,
                    "plannerItems",
                    item.id
                );


            const firebaseData = {
                ...item,
                updatedAt:
                    serverTimestamp()
            };


            if (editingId) {

                await setDoc(
                    itemRef,
                    firebaseData,
                    {
                        merge: true
                    }
                );

            } else {

                await setDoc(
                    itemRef,
                    {
                        ...firebaseData,
                        createdAt:
                            serverTimestamp()
                    }
                );
            }


            console.log(
                "☁️ Firebase synchronized"
            );

        } catch (error) {

            console.warn(
                "Firebase unavailable. Keeping local copy.",
                error
            );


            addPendingOperation({
                action:
                    editingId
                        ? "update"
                        : "create",

                item
            });
        }

    } else {

        // =========================================
        // OFFLINE
        // =========================================

        addPendingOperation({

            action:
                editingId
                    ? "update"
                    : "create",

            item
        });


        console.log(
            "🔴 Offline save queued"
        );
    }
}


// =====================================================
// DELETE
// =====================================================

async function deleteItem(id) {

    const item =
        items.find(
            existing =>
                existing.id === id
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


    // =============================================
    // DELETE LOCALLY FIRST
    // =============================================

    items =
        items.filter(
            existing =>
                existing.id !== id
        );


    saveLocalItems(
        currentUser.uid,
        items
    );


    renderAll();


    // =============================================
    // FIREBASE
    // =============================================

    if (navigator.onLine) {

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
                "Firebase delete failed:",
                error
            );


            addPendingOperation({

                action:
                    "delete",

                item: {
                    id
                }
            });
        }

    } else {

        addPendingOperation({

            action:
                "delete",

            item: {
                id
            }
        });
    }
}


// =====================================================
// EDIT
// =====================================================

function editItem(id) {

    const item =
        items.find(
            existing =>
                existing.id === id
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
// FINISHED
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
// TODAY
// =====================================================

function isToday(item) {

    if (
        item.type === "note" ||
        !item.date
    ) {

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
// MEETING LINK
// =====================================================

function getMeetingLinkName(
    url,
    type
) {

    const lower =
        String(
            url || ""
        ).toLowerCase();


    if (
        lower.includes(
            "zoom.us"
        ) ||
        lower.includes(
            "zoom.com"
        )
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
// CREATE ITEM ELEMENT
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
                ${escapeHTML(
                    item.title
                )}
            </div>

        `;
    }


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


    if (
        dotsButton &&
        menu
    ) {

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
            event => {

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
            event => {

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


    container.innerHTML =
        "";


    data.forEach(
        item => {

            container.appendChild(
                createItem(item)
            );
        }
    );


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
                    typeof a.createdAt === "string"
                        ? new Date(
                            a.createdAt
                        ).getTime()
                        : 0;


                const bTime =
                    typeof b.createdAt === "string"
                        ? new Date(
                            b.createdAt
                        ).getTime()
                        : 0;


                return (
                    bTime -
                    aTime
                );
            }
        );


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
        document.createElement(
            "div"
        );


    div.textContent =
        String(
            value ?? ""
        );


    return div.innerHTML;
}


// =====================================================
// ESCAPE ATTRIBUTE
// =====================================================

function escapeAttribute(value) {

    return String(
        value ?? ""
    )
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
// REFRESH
// =====================================================

setInterval(
    () => {

        if (currentUser) {

            renderAll();

            if (
                navigator.onLine
            ) {

                syncPendingOperations();
            }
        }

    },
    30000
);