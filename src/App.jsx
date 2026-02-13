import { Routes, Route } from "react-router-dom";
import MeoCareLanding from "./pages/Landing";
import Menu from "./pages/Menu";

function App() {
  return (
    <Routes>
      <Route path="/" element={<MeoCareLanding />} />
      <Route path="/menu" element={<Menu />} />
    </Routes>
  );
}

export default App;
