import { useState, useEffect } from "react";
import { estimateWeight } from "../client/utils/menuHelpers";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export const useShipping = ({ district, ward, items, orderTotal }) => {
  const [provinces,   setProvinces]   = useState([]);
  const [districts,   setDistricts]   = useState([]);
  const [wards,       setWards]       = useState([]);
  const [shipLoading, setShipLoading] = useState(false);
  const [shipResult,  setShipResult]  = useState(null);
  const [shipError,   setShipError]   = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/shipping/provinces`)
      .then(r => r.json())
      .then(d => setProvinces(d.data || []))
      .catch(() => {});
  }, []);

  const loadDistricts = (province) => {
    setDistricts([]); setWards([]);
    setShipResult(null); setShipError("");
    if (!province) return;
    fetch(`${API_BASE}/shipping/districts/${province.ProvinceID}`)
      .then(r => r.json())
      .then(d => setDistricts(d.data || []))
      .catch(() => {});
  };

  const loadWards = (dist) => {
    setWards([]);
    setShipResult(null); setShipError("");
    if (!dist) return;
    fetch(`${API_BASE}/shipping/wards/${dist.DistrictID}`)
      .then(r => r.json())
      .then(d => setWards(d.data || []))
      .catch(() => {});
  };

  const calculateFee = (dist, w) => {
    if (!w || !dist) return;
    setShipLoading(true);
    setShipResult(null);
    setShipError("");
    fetch(`${API_BASE}/shipping/fee`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to_district_id: dist.DistrictID,
        to_ward_code:   w.WardCode,
        weight: estimateWeight(items),
        order_total: orderTotal,
      }),
    })
      .then(r => r.json())
      .then(d => { if (d.error) setShipError(d.error); else setShipResult(d); })
      .catch(() => setShipError("Không thể kết nối tính phí ship."))
      .finally(() => setShipLoading(false));
  };

  return { provinces, districts, wards, shipLoading, shipResult, shipError,
           loadDistricts, loadWards, calculateFee };
};