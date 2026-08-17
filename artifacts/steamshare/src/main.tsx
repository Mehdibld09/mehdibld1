import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Disable browser-native scroll restoration so a page refresh always
// starts at the top. Must run before React mounts (useEffect is too late).
history.scrollRestoration = "manual";

// If the app is loaded on the admin subdomain (e.g. admin.myweb.xyz),
// open the login screen directly; /admin performs the auth check after login.
const hostname = window.location.hostname;
if (hostname.startsWith("admin.") && window.location.pathname === "/") {
  history.replaceState(null, "", "/login");
}

createRoot(document.getElementById("root")!).render(<App />);
