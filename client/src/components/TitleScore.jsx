import './TitleScore.css';

const SCORE_LETTERS = ['C', 'R', 'A', 'Z', 'Y', 'C', 'R', 'A', 'C', 'K'];

export default function TitleScore({ linesCompleted }) {
  return (
    <div className="title-score-container">
      {SCORE_LETTERS.map((letter, index) => {
        const isStruck = index < linesCompleted;
        // The first 5 are "CRAZY" and the next 5 are "CRACK"
        // We'll add a little space between Y and C
        const isSpace = index === 4; 

        return (
          <span key={index} style={{ marginRight: isSpace ? '1rem' : '0' }}>
            <span className={`title-letter ${isStruck ? 'struck' : ''}`}>
              {letter}
              {isStruck && <div className="letter-strike-line"></div>}
            </span>
          </span>
        );
      })}
    </div>
  );
}
