interface DiceProps {
  value: number;
  rolling: boolean;
}

const DOTS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

export default function Dice({ value, rolling }: DiceProps) {
  const dots = DOTS[value] || [];

  return (
    <div className={`dice ${rolling ? 'rolling' : ''}`}>
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} className={`dice-dot ${dots.includes(i) ? 'visible' : ''}`} />
      ))}
    </div>
  );
}
