// =====================================================
// MY PLANNER SERVICE WORKER
// =====================================================

const CACHE_NAME =
    "my-planner-v2";


// =====================================================
// FILES TO CACHE
// =====================================================

const APP_FILES = [

    "./",

    "./index.html",

    "./style.css",

    "./script.js",

    "./auth.js",

    "./auth.css",

    "./login.html",

    "./signup.html",

    "./forgot-password.html",

    "./reset-password.html",

    "./manifest.json",

    "./img/image1.jpg"

];


// =====================================================
// INSTALL
// =====================================================

self.addEventListener(
    "install",
    (event) => {

        console.log(
            "Planner Service Worker installing..."
        );


        event.waitUntil(

            caches
                .open(CACHE_NAME)
                .then(
                    (cache) => {

                        return cache.addAll(
                            APP_FILES
                        );

                    }
                )

        );


        self.skipWaiting();

    }
);


// =====================================================
// ACTIVATE
// =====================================================

self.addEventListener(
    "activate",
    (event) => {

        console.log(
            "Planner Service Worker activated."
        );


        event.waitUntil(

            caches
                .keys()
                .then(
                    (cacheNames) => {

                        return Promise.all(

                            cacheNames
                                .filter(
                                    (name) =>
                                        name !==
                                        CACHE_NAME
                                )
                                .map(
                                    (name) =>
                                        caches.delete(
                                            name
                                        )
                                )

                        );

                    }
                )

        );


        self.clients.claim();

    }
);


// =====================================================
// FETCH
// =====================================================

self.addEventListener(
    "fetch",
    (event) => {

        const request =
            event.request;


        /*
         * Only cache GET requests.
         */

        if (
            request.method !==
            "GET"
        ) {

            return;
        }


        /*
         * Don't interfere with Firebase
         * network requests.
         *
         * Firestore has its own offline
         * persistence system.
         */

        if (
            request.url.includes(
                "googleapis.com"
            ) ||
            request.url.includes(
                "gstatic.com"
            ) ||
            request.url.includes(
                "firebaseio.com"
            )
        ) {

            return;
        }


        event.respondWith(

            caches
                .match(request)
                .then(
                    (cachedResponse) => {

                        /*
                         * If the file exists locally,
                         * use it immediately.
                         */

                        if (
                            cachedResponse
                        ) {

                            return cachedResponse;

                        }


                        /*
                         * Otherwise try Internet.
                         */

                        return fetch(
                            request
                        )
                            .then(
                                (networkResponse) => {

                                    /*
                                     * Save successful
                                     * responses.
                                     */

                                    if (
                                        networkResponse &&
                                        networkResponse.status ===
                                            200 &&
                                        networkResponse.type ===
                                            "basic"
                                    ) {

                                        const clone =
                                            networkResponse.clone();


                                        caches
                                            .open(
                                                CACHE_NAME
                                            )
                                            .then(
                                                (cache) => {

                                                    cache.put(
                                                        request,
                                                        clone
                                                    );

                                                }
                                            );

                                    }


                                    return networkResponse;

                                }
                            )
                            .catch(
                                () => {

                                    /*
                                     * If offline and
                                     * nothing was found,
                                     * return cached index.
                                     */

                                    return caches.match(
                                        "./index.html"
                                    );

                                }
                            );

                    }
                )

        );

    }
);