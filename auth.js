// =====================================================
// auth.js
// =====================================================

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail,
    verifyPasswordResetCode,
    confirmPasswordReset,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    auth
} from "./firebase-config.js";


// =====================================================
// ELEMENT HELPER
// =====================================================

function $(id) {
    return document.getElementById(id);
}


// =====================================================
// MESSAGE
// =====================================================

function showMessage(
    message,
    type = "error"
) {

    const box = $("authMessage");

    if (!box) return;

    box.textContent = message;

    box.className =
        `auth-message show ${type}`;
}


function clearMessage() {

    const box = $("authMessage");

    if (!box) return;

    box.textContent = "";

    box.className =
        "auth-message";
}


// =====================================================
// FIREBASE ERROR TRANSLATION
// =====================================================

function firebaseError(error) {

    const code =
        error?.code || "";

    const messages = {

        "auth/invalid-email":
            "Please enter a valid email address.",

        "auth/user-not-found":
            "No account was found with this email.",

        "auth/wrong-password":
            "Incorrect password.",

        "auth/invalid-credential":
            "Incorrect email or password.",

        "auth/email-already-in-use":
            "An account already exists with this email.",

        "auth/weak-password":
            "Password must be at least 6 characters.",

        "auth/popup-closed-by-user":
            "Google sign-in was cancelled.",

        "auth/popup-blocked":
            "Your browser blocked the Google sign-in popup.",

        "auth/unauthorized-domain":
            "This website domain is not authorized in Firebase. Add this domain under Firebase Authentication → Settings → Authorized domains.",

        "auth/network-request-failed":
            "Network error. Check your internet connection.",

        "auth/too-many-requests":
            "Too many attempts. Please wait and try again.",

        "auth/expired-action-code":
            "This reset link has expired.",

        "auth/invalid-action-code":
            "This reset link is invalid or has already been used.",

        "auth/missing-email":
            "Please enter your email address."

    };


    return (
        messages[code] ||
        error?.message ||
        "Something went wrong. Please try again."
    );
}


// =====================================================
// PASSWORD TOGGLE
// =====================================================

document
    .querySelectorAll(".password-toggle")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const target =
                    button.dataset.target;

                const input =
                    $(target);

                if (!input) return;


                if (
                    input.type === "password"
                ) {

                    input.type =
                        "text";

                    button.textContent =
                        "🙈";

                } else {

                    input.type =
                        "password";

                    button.textContent =
                        "👁";
                }

            }
        );

    });


// =====================================================
// DETECT CURRENT PAGE
// =====================================================

const currentPath =
    window.location.pathname.toLowerCase();

const isLoginPage =
    currentPath.endsWith(
        "login.html"
    );

const isSignupPage =
    currentPath.endsWith(
        "signup.html"
    );

const isForgotPasswordPage =
    currentPath.endsWith(
        "forgot-password.html"
    );

const isResetPasswordPage =
    currentPath.endsWith(
        "reset-password.html"
    );

const isPlannerPage =
    currentPath.endsWith(
        "index.html"
    ) ||
    currentPath === "/" ||
    currentPath.endsWith("/");


// =====================================================
// AUTH STATE
// =====================================================

onAuthStateChanged(
    auth,
    user => {

        // =================================================
        // PLANNER PAGE PROTECTION
        // =================================================

        if (isPlannerPage) {

            if (!user) {

                /*
                 * User is NOT logged in.
                 *
                 * Do not allow access to planner.
                 */

                window.location.replace(
                    "login.html"
                );

                return;
            }


            /*
             * User IS logged in.
             *
             * Remove loading screen.
             */

            document.body.classList.remove(
                "auth-loading"
            );


            const loading =
                $("auth-loading");

            if (loading) {

                loading.style.display =
                    "none";
            }


            /*
             * Display user information.
             */

            const userName =
                $("user-name");

            const userEmail =
                $("user-email");


            if (userName) {

                userName.textContent =
                    user.displayName ||
                    user.email?.split("@")[0] ||
                    "User";
            }


            if (userEmail) {

                userEmail.textContent =
                    user.email || "";
            }


            /*
             * Setup logout button.
             */

            const logoutButton =
                $("logout-btn");


            if (logoutButton) {

                /*
                 * Avoid attaching the event
                 * more than once.
                 */

                if (
                    !logoutButton.dataset.listener
                ) {

                    logoutButton.dataset.listener =
                        "true";


                    logoutButton.addEventListener(
                        "click",
                        async () => {

                            logoutButton.disabled =
                                true;

                            logoutButton.innerHTML =
                                `
                                <span>↪</span>
                                Logging out...
                                `;


                            try {

                                await signOut(
                                    auth
                                );


                                /*
                                 * replace() prevents
                                 * going back to the
                                 * planner using the
                                 * browser Back button.
                                 */

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


                                logoutButton.disabled =
                                    false;

                                logoutButton.innerHTML =
                                    `
                                    <span>↪</span>
                                    Logout
                                    `;
                            }

                        }
                    );
                }
            }

        }


        // =================================================
        // AUTH PAGES
        // =================================================

        if (
            isLoginPage ||
            isSignupPage
        ) {

            /*
             * Already logged in?
             * Send user directly to planner.
             */

            if (user) {

                window.location.replace(
                    "index.html"
                );
            }

        }

    }
);


// =====================================================
// LOGIN
// =====================================================

const loginForm =
    $("loginForm");


if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            clearMessage();


            const email =
                $("email")
                    .value
                    .trim();

            const password =
                $("password")
                    .value;

            const button =
                $("loginButton");


            if (!email || !password) {

                showMessage(
                    "Please enter your email and password."
                );

                return;
            }


            button.disabled =
                true;

            button.textContent =
                "Signing in...";


            try {

                await signInWithEmailAndPassword(
                    auth,
                    email,
                    password
                );


                /*
                 * Firebase authentication state
                 * will update automatically.
                 */

                window.location.replace(
                    "index.html"
                );


            } catch (error) {

                console.error(error);

                showMessage(
                    firebaseError(error)
                );


                button.disabled =
                    false;

                button.textContent =
                    "Sign In";
            }

        }
    );
}


// =====================================================
// GOOGLE LOGIN
// =====================================================

const googleButton =
    $("googleButton");


if (googleButton) {

    googleButton.addEventListener(
        "click",
        async () => {

            clearMessage();


            googleButton.disabled =
                true;

            googleButton.innerHTML =
                "Signing in with Google...";


            try {

                const provider =
                    new GoogleAuthProvider();


                provider.setCustomParameters({
                    prompt: "select_account"
                });


                await signInWithPopup(
                    auth,
                    provider
                );


                window.location.replace(
                    "index.html"
                );


            } catch (error) {

                console.error(error);

                showMessage(
                    firebaseError(error)
                );


                googleButton.disabled =
                    false;

                googleButton.innerHTML =
                    `
                    <span class="google-icon">
                        G
                    </span>

                    Continue with Google
                    `;
            }

        }
    );
}


// =====================================================
// SIGN UP
// =====================================================

const signupForm =
    $("signupForm");


if (signupForm) {

    signupForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            clearMessage();


            const email =
                $("email")
                    .value
                    .trim();

            const password =
                $("password")
                    .value;

            const confirmPassword =
                $("confirmPassword")
                    .value;

            const button =
                $("signupButton");


            if (
                !email ||
                !password ||
                !confirmPassword
            ) {

                showMessage(
                    "Please complete all fields."
                );

                return;
            }


            if (
                password.length < 6
            ) {

                showMessage(
                    "Password must be at least 6 characters."
                );

                return;
            }


            if (
                password !==
                confirmPassword
            ) {

                showMessage(
                    "Passwords do not match."
                );

                return;
            }


            button.disabled =
                true;

            button.textContent =
                "Creating account...";


            try {

                await createUserWithEmailAndPassword(
                    auth,
                    email,
                    password
                );


                window.location.replace(
                    "index.html"
                );


            } catch (error) {

                console.error(error);

                showMessage(
                    firebaseError(error)
                );


                button.disabled =
                    false;

                button.textContent =
                    "Create Account";
            }

        }
    );
}


// =====================================================
// FORGOT PASSWORD
// =====================================================

const forgotForm =
    $("forgotForm");


if (forgotForm) {

    forgotForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            clearMessage();


            const email =
                $("email")
                    .value
                    .trim();

            const button =
                $("forgotButton");


            if (!email) {

                showMessage(
                    "Please enter your email address."
                );

                return;
            }


            button.disabled =
                true;

            button.textContent =
                "Sending...";


            try {

                const actionCodeSettings = {

                    url:
                        `${window.location.origin}/reset-password.html`,

                    handleCodeInApp:
                        true
                };


                await sendPasswordResetEmail(
                    auth,
                    email,
                    actionCodeSettings
                );


                showMessage(
                    "Password reset email sent. Check your inbox and follow the link.",
                    "success"
                );


                button.disabled =
                    false;

                button.textContent =
                    "Send Reset Link";


            } catch (error) {

                console.error(error);

                showMessage(
                    firebaseError(error)
                );


                button.disabled =
                    false;

                button.textContent =
                    "Send Reset Link";
            }

        }
    );
}


// =====================================================
// RESET PASSWORD
// =====================================================

const resetForm =
    $("resetForm");


if (resetForm) {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const mode =
        params.get("mode");

    const actionCode =
        params.get("oobCode");


    if (
        mode !== "resetPassword" ||
        !actionCode
    ) {

        showMessage(
            "This password reset link is invalid or incomplete."
        );


        resetForm.style.display =
            "none";

    } else {

        verifyPasswordResetCode(
            auth,
            actionCode
        )

        .then(email => {

            const resetEmail =
                $("resetEmail");


            if (resetEmail) {

                resetEmail.textContent =
                    email;
            }

        })

        .catch(error => {

            console.error(error);

            showMessage(
                firebaseError(error)
            );


            resetForm.style.display =
                "none";
        });


        resetForm.addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                clearMessage();


                const password =
                    $("password")
                        .value;

                const confirmPassword =
                    $("confirmPassword")
                        .value;

                const button =
                    $("resetButton");


                if (
                    password.length < 6
                ) {

                    showMessage(
                        "Password must be at least 6 characters."
                    );

                    return;
                }


                if (
                    password !==
                    confirmPassword
                ) {

                    showMessage(
                        "Passwords do not match."
                    );

                    return;
                }


                button.disabled =
                    true;

                button.textContent =
                    "Resetting password...";


                try {

                    await confirmPasswordReset(
                        auth,
                        actionCode,
                        password
                    );


                    showMessage(
                        "Password reset successfully. Redirecting to login...",
                        "success"
                    );


                    resetForm.style.display =
                        "none";


                    setTimeout(
                        () => {

                            window.location.replace(
                                "login.html"
                            );

                        },
                        2000
                    );


                } catch (error) {

                    console.error(error);

                    showMessage(
                        firebaseError(error)
                    );


                    button.disabled =
                        false;

                    button.textContent =
                        "Reset Password";
                }

            }
        );
    }
}
