import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export interface TimeSeriesPoint {
  label: string;
  info: number;
  warn: number;
  error: number;
  fatal: number;
}

interface Props {
  data: TimeSeriesPoint[];
}

export default function LogsOverTimeChart({
  data,
}: Props) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-8">
      <div className="mb-5">
        <h2 className="text-2xl font-semibold">
          Logs Over Time
        </h2>

        <p className="text-gray-400 mt-1">
          Log activity by severity
        </p>
      </div>

      {data.length === 0 ? (
        <div className="h-[360px] flex items-center justify-center text-gray-500">
          No time-series data available
        </div>
      ) : (
        <div className="h-[360px]">
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <LineChart
              data={data}
              margin={{
                top: 10,
                right: 20,
                left: 5,
                bottom: 10,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#27272a"
              />

              <XAxis
                dataKey="label"
                stroke="#71717a"
                tick={{ fontSize: 12 }}
              />

              <YAxis
                allowDecimals={false}
                stroke="#71717a"
                tick={{ fontSize: 12 }}
              />

              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: "8px",
                  color: "#fff",
                }}
              />

              <Legend />

              <Line
                type="monotone"
                dataKey="info"
                name="Info"
                stroke="#34d399"
                strokeWidth={2}
                dot={false}
              />

              <Line
                type="monotone"
                dataKey="warn"
                name="Warning"
                stroke="#facc15"
                strokeWidth={2}
                dot={false}
              />

              <Line
                type="monotone"
                dataKey="error"
                name="Error"
                stroke="#f87171"
                strokeWidth={2}
                dot={false}
              />

              <Line
                type="monotone"
                dataKey="fatal"
                name="Fatal"
                stroke="#dc2626"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}