import React from 'react';
import './ConfirmModal.css';

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="confirm-modal panel">
                <h2>{title}</h2>
                <p>{message}</p>
                <div className="modal-actions">
                    <button className="secondary-btn" onClick={onCancel}>Cancel</button>
                    <button className="danger-btn" onClick={onConfirm}>Leave Game</button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
