import { useLocation, useNavigate } from "react-router-dom";
import { IconBack, IconDots, IconShieldCheck } from "./icons";
import { useSheet } from "./sheet";

/**
 * Topbar — verbatim from the reference mockup:
 * circular back button, centered DEFENXIA brand, circular menu button.
 */
export const TopBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { openSheet } = useSheet();

  const goBack = () => {
    if (location.pathname === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate(-1);
    }
  };

  return (
    <nav className="topbar" aria-label="Top">
      <button className="circle-btn" aria-label="Go back" onClick={goBack}>
        <IconBack />
      </button>
      <button className="brand" aria-label="DEFENXIA home" onClick={() => navigate("/")}>
        DEFENXIA
      </button>
      <button
        className="circle-btn"
        aria-label="About DEFENXIA"
        onClick={() =>
          openSheet({
            icon: <IconShieldCheck />,
            title: "DEFENXIA",
            desc: "Your device's ultimate protector. Scan links, networks, apps and messages for threats — all from one calm, private dashboard.",
            ctaText: "Got it",
          })
        }
      >
        <IconDots />
      </button>
    </nav>
  );
};
