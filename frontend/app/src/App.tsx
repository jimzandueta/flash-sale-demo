import { useState } from 'react';

export default function App() {
  const [userToken] = useState<string | null>(null);

  if (!userToken) {
    return (
      <main>
        <h1>Flash Sale</h1>
        <p>Enter your name</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Flash Sale</h1>
      <p>Sales and reservations go here.</p>
    </main>
  );
}