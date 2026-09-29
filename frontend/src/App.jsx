import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ChatApp from './ChatApp';
import Presentation from './Presentation';
import PlansManager from './PlansManager';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Presentation />} />
        <Route path="/chat" element={<ChatApp />} />
        <Route path="/plans" element={<PlansManager />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
