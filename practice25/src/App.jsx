import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

const About = lazy(() => import('./pages/About'));
import Home from './pages/Home';

function App() {
  return (
    <BrowserRouter>
      <nav style={{ marginBottom: '20px' }}>
        <Link to="/" style={{ marginRight: '10px' }}>Главная</Link>
        <Link to="/about">О нас</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route 
          path="/about" 
          element={
            <Suspense fallback={<div>Загрузка...</div>}>
              <About />
            </Suspense>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;