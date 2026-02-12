import { Routes, Route } from "react-router-dom";
import MeoCare from "./meo_care_landing";
import ProductList from "./product_list";

function App() {
  return (
    <Routes>
      <Route path="/" element={<MeoCare />} />
      <Route path="/products" element={<ProductList />} />
    </Routes>
  );
}

export default App;
