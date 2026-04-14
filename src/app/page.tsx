export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <h1>Chenyu Blog - 施工中</h1>
      {/* 使用映射好的 Tailwind 变量测试颜色渲染 */}
      <p className="mt-4 text-text-muted">全局设计 Token 注入成功</p>
      <button className="mt-6 bg-accent text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-accent-hover transition">
        测试主题色
      </button>
    </main>
  );
}
