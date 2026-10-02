import { Navigate } from "react-router-dom";

function ProtectedRoute({ children }) {
  return localStorage.getItem("token") ? children : <Navigate to="/login" replace />;
}

export default ProtectedRoute;
