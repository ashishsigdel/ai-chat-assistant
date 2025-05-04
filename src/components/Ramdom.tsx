export default function Ramdom() {
  return (
    <div className="flex w-full h-screen items-center justify-center">
      {new Date().toLocaleString()}
      {Math.random()}
    </div>
  );
}
