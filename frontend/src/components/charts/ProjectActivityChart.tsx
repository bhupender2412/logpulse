import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

interface LogEvent {
  projectId: string;
}

interface Props {
  logs: LogEvent[];
}

export default function ProjectActivityChart({
  logs,
}: Props) {
  const projectCounts: Record<
    string,
    number
  > = {};

  logs.forEach((log) => {
    projectCounts[log.projectId] =
      (projectCounts[log.projectId] || 0) +
      1;
  });

  const chartData = Object.entries(
    projectCounts
  )
    .map(([project, count]) => ({
      project,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 h-[420px]">
      <h2 className="text-2xl font-semibold mb-1">
        Project Activity
      </h2>

      <p className="text-gray-400 mb-4">
        Most active projects
      </p>

      <ResponsiveContainer
        width="100%"
        height="85%"
      >
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{
            left: 100,
          }}
        >
          <XAxis type="number" />

          <YAxis
            type="category"
            dataKey="project"
            width={120}
          />

          <Tooltip />

          <Bar
            dataKey="count"
            fill="#818cf8"
          />
          
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}