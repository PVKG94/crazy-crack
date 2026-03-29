import { useState } from 'react';
import './HowToPlay.css';

export default function HowToPlay({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="htp-modal panel" onClick={e => e.stopPropagation()}>
        <h2>How to Play</h2>

        <div className="htp-steps">
          <div className="htp-step">
            <span className="htp-num">1</span>
            <div>
              <h4>Set Up Your Board</h4>
              <p>Randomize your 10×10 grid. Numbers 1–100 are placed randomly. Every player gets a different layout!</p>
            </div>
          </div>

          <div className="htp-step">
            <span className="htp-num">2</span>
            <div>
              <h4>Take Turns Calling</h4>
              <p>On your turn, tap any uncalled number on your board. That number gets "called" for everyone.</p>
            </div>
          </div>

          <div className="htp-step">
            <span className="htp-num">3</span>
            <div>
              <h4>Complete Lines</h4>
              <p>When all 10 numbers in a row, column, or diagonal are called, that line is complete. There are 22 possible lines (10 rows + 10 columns + 2 diagonals).</p>
            </div>
          </div>

          <div className="htp-step">
            <span className="htp-num">4</span>
            <div>
              <h4>Win the Game</h4>
              <p>The first player to complete all 22 lines wins! 🏆 Race to cross out your entire board before anyone else.</p>
            </div>
          </div>
        </div>

        <div className="htp-tip">
          💡 <strong>Strategy tip:</strong> Call numbers that complete <em>your</em> lines — but remember, opponents might benefit from your calls too!
        </div>

        <button className="primary-btn htp-close" onClick={onClose}>Got it!</button>
      </div>
    </div>
  );
}
