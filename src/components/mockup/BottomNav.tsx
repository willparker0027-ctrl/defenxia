import { NavLink, useLocation } from "react-router-dom";
import { IconGrid, IconShieldCheck, IconActivity, IconGear } from "./icons";

/**
 * Bottom navigation — verbatim from the reference mockup:
 * four glass items, icons above mono labels, active item glows magenta.
 */
const tabs = [
  { to: "/", label: "Home", Icon: IconGrid, match: ["/"] },
  { to: "/scanning", label: "Protect", Icon: IconShieldCheck, match: ["/scanning"] },
  { to: "/report-analysis", label: "Activity", Icon: IconActivity, match: ["/report-analysis"] },
  { to: "/settings", label: "Settings", Icon: IconGear, match: ["/settings"] },
];

export const BottomNav = () => {
  const { pathname } = useLocation();

  return (
    <nav className="glass nav" aria-label="Primary">
      {tabs.map(({ to, label, Icon, match }) => (
        <NavLink
          key={to}
          to={to}
          className={`nav-item${match.includes(pathname) ? " active" : ""}`}
        >
          <Icon />
          {label}
        </NavLink>
      ))}
    </nav>
  );
};
