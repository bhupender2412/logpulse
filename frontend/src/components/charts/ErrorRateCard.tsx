interface Props {
  totalLogs: number;
  errorCount: number;
  fatalCount: number;
}

export default function ErrorRateCard({
  totalLogs,
  errorCount,
  fatalCount,
}: Props) {
  const errorRate =
    totalLogs === 0
      ? 0
      : (
          ((errorCount + fatalCount) /
            totalLogs) *
          100
        ).toFixed(1);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 h-[420px] flex flex-col justify-center items-center">
      <h2 className="text-2xl font-semibold">
        Error Rate
      </h2>

      <p className="text-gray-400 mb-8">
        Errors + Fatal logs
      </p>

      <div className="text-7xl font-bold text-red-400">
        {errorRate}%
      </div>

      <p className="text-gray-400 mt-4">
        of logs are errors
      </p>
    </div>
  );
}