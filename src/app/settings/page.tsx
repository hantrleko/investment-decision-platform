export default async function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-2 text-muted-foreground">
        Framework configuration, data import/export, and account settings.
      </p>
      <div className="mt-6 space-y-4">
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold">Frameworks</h2>
          <p className="text-sm text-muted-foreground">
            Manage scoring framework definitions. Available in a future mission.
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold">Data Import / Export</h2>
          <p className="text-sm text-muted-foreground">
            Import and export CSV data. Available in a future mission.
          </p>
        </div>
      </div>
    </div>
  );
}
