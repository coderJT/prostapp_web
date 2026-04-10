import { createBrowserRouter } from "react-router";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { Dashboard } from "./pages/Dashboard";
import { RiskAssessment } from "./pages/RiskAssessment";
import { MedicalHistory } from "./pages/MedicalHistory";
import { Results } from "./pages/Results";
import { Education } from "./pages/Education";
import { Appointments } from "./pages/Appointments";
import { Profile } from "./pages/Profile";
import { AdminPanel } from "./pages/AdminPanel";
import { GroqAnswers } from "./pages/GroqAnswers";
import { NotFound } from "./pages/NotFound";

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
        path: "medical-history",
        Component: MedicalHistory,
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
        path: "profile",
        Component: Profile,
      },
      {
        path: "groq-answers",
        Component: GroqAnswers,
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
