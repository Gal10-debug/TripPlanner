import { useEffect, useState } from 'react'

import './App.css'

function App() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("http://localhost:5075/api/hello")
        .then(response => response.text())
        .then(data => {
            setMessage(data);
        });
}, []);
  
  return (
    <>
    <h1>Trip Planner</h1>
    <h2>{message}</h2>
    </>
  );
}

export default App;
