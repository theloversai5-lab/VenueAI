import { NewVenueForm } from "./new-venue-form";

export default function NewVenuePage() {
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="heading-font text-3xl text-white">New venue</h1>
      <div className="glass-card mt-6 rounded-xl p-6">
        <NewVenueForm />
      </div>
    </div>
  );
}
