import { CarSilhouette } from './CarSilhouette';
import { ButtonLink } from './ui';

export function ErrorPage({ code, title, description }: { code: string; title: string; description: string }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-7xl font-black tracking-tighter text-slate-200">{code}</p>
      <CarSilhouette type="hatchback" className="-mt-2 w-48 text-slate-300" />
      <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-2 text-slate-500">{description}</p>
      <div className="mt-8 flex gap-3">
        <ButtonLink href="/cars">Browse cars</ButtonLink>
        <ButtonLink href="/" variant="secondary">
          Go home
        </ButtonLink>
      </div>
    </div>
  );
}
