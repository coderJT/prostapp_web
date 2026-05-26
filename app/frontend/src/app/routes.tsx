import { Navigate, createBrowserRouter } from "react-router";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { Dashboard } from "./pages/Dashboard";
import { RiskAssessment } from "./pages/RiskAssessment";
import { Results } from "./pages/Results";
import { Education } from "./pages/Education";
import { Appointments } from "./pages/Appointments";
import { MailPage } from "./pages/Mail";
import { Profile } from "./pages/Profile";
import { AdminPanel } from "./pages/AdminPanel";
import { NotFound } from "./pages/NotFound";
import { HistoryReport } from "./pages/HistoryReport";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: LandingPage,
  },
  {
    path: "/login",
    Component: LoginPage,
  },
  {
    path: "/signup",
    Component: SignupPage,
  },
  {
    path: "/dashboard",
    Component: Dashboard,
    children: [
      {
        path: "risk-assessment",
        Component: RiskAssessment,
      },
      {
        path: "results",
        Component: Results,
      },
      {
        path: "education",
        Component: Education,
      },
      {
        path: "appointments",
        Component: Appointments,
      },
      {
        path: "mail",
        Component: MailPage,
      },
      {
        path: "profile",
        Component: Profile,
      },
      {
        path: "report-explanations",
        element: <Navigate to="/dashboard/history-report" replace />,
      },
      {
        path: "groq-answers",
        element: <Navigate to="/dashboard/history-report" replace />,
      },
      {
        path: "history-report",
        Component: HistoryReport,
      },
    ],
  },
  {
    path: "/admin",
    Component: AdminPanel,
  },
  {
    path: "*",
    Component: NotFound,
  },
]);
