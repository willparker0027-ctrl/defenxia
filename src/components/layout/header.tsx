import { Shield, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";

export const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const isHomePage = location.pathname === "/";

  return (
    <header className="sticky top-0 z-50 w-full glass glass-nav border-x-0 border-t-0">
      <div className="container flex h-16 items-center justify-between px-4">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <Shield className="h-8 w-8 text-magenta" />
          <h1 className="text-xl font-serif text-ink">
            Defenxia
          </h1>
        </button>
        
        <div className="flex items-center gap-3">
          {!isHomePage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="text-mist"
            >
              ← Back
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/settings")}
            className="text-mist"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};
