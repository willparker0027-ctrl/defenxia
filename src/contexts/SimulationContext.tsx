import { createContext, useContext, useState, ReactNode } from "react";

interface SimulationContextType {
  isSimulating: boolean;
  setIsSimulating: (v: boolean) => void;
}

const SimulationContext = createContext<SimulationContextType>({
  isSimulating: false,
  setIsSimulating: () => {},
});

export const useSimulation = () => useContext(SimulationContext);

export const SimulationProvider = ({ children }: { children: ReactNode }) => {
  const [isSimulating, setIsSimulating] = useState(false);
  return (
    <SimulationContext.Provider value={{ isSimulating, setIsSimulating }}>
      {children}
    </SimulationContext.Provider>
  );
};
