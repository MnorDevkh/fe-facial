import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Attendance from "./pages/Attendance";
import AttendanceView from "./pages/AttendanceView";
import Classes from "./pages/Classes";
import Dashboard from "./pages/Dashboard";
import Dataset from "./pages/Dataset";
import People from "./pages/People";
import Recognize from "./pages/Recognize";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="people" element={<People />} />
          <Route path="classes" element={<Classes />} />
          <Route path="dataset" element={<Dataset />} />
          <Route path="recognize" element={<Recognize />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="view-attendance" element={<AttendanceView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
