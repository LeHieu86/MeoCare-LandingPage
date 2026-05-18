import React, { createContext, useContext, useState, useCallback } from "react";
import "../styles/confirm-dialog.css";

const ConfirmContext = createContext(null);

export const ConfirmProvider = ({ children }) => {
  const [state, setState] = useState({ open: false, message: "", title: "Xác nhận", resolve: null });

  const confirm = useCallback((message, title = "Xác nhận") => {
    return new Promise((resolve) => {
      setState({ open: true, message, title, resolve });
    });
  }, []);

  const handleYes = () => {
    state.resolve?.(true);
    setState((s) => ({ ...s, open: false }));
  };

  const handleNo = () => {
    state.resolve?.(false);
    setState((s) => ({ ...s, open: false }));
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state.open && (
        <div className="confirm-overlay" onClick={handleNo}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon">⚠️</div>
            <h4 className="confirm-title">{state.title}</h4>
            <p className="confirm-message">{state.message}</p>
            <div className="confirm-actions">
              <button className="confirm-btn-no" onClick={handleNo}>Không</button>
              <button className="confirm-btn-yes" onClick={handleYes}>Xác nhận</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => useContext(ConfirmContext);
