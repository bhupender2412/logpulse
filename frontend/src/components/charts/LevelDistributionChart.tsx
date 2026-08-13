import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

interface Props {
  info: number;
  warn: number;
  error: number;
  fatal: number;
}

const COLORS = [
  "#34d399",
  "#facc15",
  "#f87171",
  "#dc2626",
];

export default function LevelDistributionChart({
  info,
  warn,
  error,
  fatal,
}: Props) {
  const data = [
    {
      name: "Info",
      value: info,
    },
    {
      name: "Warning",
      value: warn,
    },
    {
      name: "Error",
      value: error,
    },
    {
      name: "Fatal",
      value: fatal,
    },
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 h-[420px]">
      <h2 className="text-2xl font-semibold mb-1">
        Level Distribution
      </h2>

      <p className="text-gray-400 mb-4">
        Logs by severity
      </p>

      <ResponsiveContainer
        width="100%"
        height="85%"
      >
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            outerRadius={120}
            label
          >
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={
                  COLORS[
                    index %
                      COLORS.length
                  ]
                }
              />
            ))}
          </Pie>

          <Tooltip />

          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}