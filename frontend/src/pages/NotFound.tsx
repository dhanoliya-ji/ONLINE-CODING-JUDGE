import { Link } from "react-router-dom";
import { Card } from "../components/ui";

export function NotFound() {
  return (
    <div className="mx-auto grid min-h-[60dvh] max-w-lg place-items-center px-4">
      <Card solid edge className="w-full p-10 text-center">
        <p className="gradient-text font-mono text-6xl font-black">404</p>
        <h1 className="mt-4 text-xl font-bold text-violet-50">
          Nothing here
        </h1>
        <p className="mt-2 text-sm text-violet-200/55">
          That page does not exist, or it moved.
        </p>
        <Link
          to="/"
          className="btn-primary mt-7 inline-block rounded-xl px-6 py-2.5 text-sm font-semibold text-white"
        >
          Back home
        </Link>
      </Card>
    </div>
  );
}
