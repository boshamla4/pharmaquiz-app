export default function QuestionMedia({ images, alt }: { images?: string[]; alt: string }) {
  if (!images || images.length === 0) return null;

  return (
    <div className="mt-3 grid gap-3">
      {images.map((src) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt={alt}
          className="max-h-72 w-auto rounded-lg border border-gray-200"
          loading="lazy"
        />
      ))}
    </div>
  );
}
