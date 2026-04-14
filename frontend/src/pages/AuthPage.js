import { useState } from "react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_REGEX = /^[A-Za-z ]{2,50}$/;
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
const DEPARTMENTS = ["Electricity", "Gas", "Water"];

const getUsers = () => {
  try {
    return JSON.parse(localStorage.getItem("ubms_users") || "[]");
  } catch {
    return [];
  }
};

const setUsers = (users) => {
  localStorage.setItem("ubms_users", JSON.stringify(users));
};

function AuthPage({ onAuthSuccess }) {
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    department: "Electricity"
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
    setMessage("");
  };

  const validateSignUp = () => {
    const nextErrors = {};

    if (!NAME_REGEX.test(form.name.trim())) {
      nextErrors.name = "Enter a valid name (2-50 letters/spaces).";
    }
    if (!EMAIL_REGEX.test(form.email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!STRONG_PASSWORD_REGEX.test(form.password)) {
      nextErrors.password = "Password must be 8+ chars with upper, lower, number, and symbol.";
    }
    if (!DEPARTMENTS.includes(form.department)) {
      nextErrors.department = "Select a valid department.";
    }
    if (form.password !== form.confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    return nextErrors;
  };

  const validateSignIn = () => {
    const nextErrors = {};

    if (!EMAIL_REGEX.test(form.email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!form.password) {
      nextErrors.password = "Password is required.";
    }
    if (!DEPARTMENTS.includes(form.department)) {
      nextErrors.department = "Select a valid department.";
    }

    return nextErrors;
  };

  const handleSignUp = () => {
    const nextErrors = validateSignUp();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    const users = getUsers();
    const exists = users.some((u) => u.email.toLowerCase() === form.email.trim().toLowerCase());

    if (exists) {
      setErrors({ email: "Email already registered. Please sign in." });
      return;
    }

    const user = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      department: form.department
    };

    setUsers([...users, user]);
    onAuthSuccess({ name: user.name, email: user.email, department: user.department });
  };

  const handleSignIn = () => {
    const nextErrors = validateSignIn();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    const users = getUsers();
    const user = users.find(
      (u) =>
        u.email.toLowerCase() === form.email.trim().toLowerCase() &&
        u.password === form.password &&
        (u.department || form.department) === form.department
    );

    if (!user) {
      setMessage("Invalid credentials or wrong department selected.");
      return;
    }

    if (!user.department) {
      const updatedUsers = users.map((u) =>
        u.email.toLowerCase() === user.email.toLowerCase()
          ? { ...u, department: form.department }
          : u
      );
      setUsers(updatedUsers);
    }

    onAuthSuccess({
      name: user.name,
      email: user.email,
      department: user.department || form.department
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === "signup") {
      handleSignUp();
      return;
    }
    handleSignIn();
  };

  return (
    <div className="auth-shell">
      <div className="auth-hero">
        <h1>GridFlow Utility</h1>
        <p>Secure utility operations with smart billing, meter tracking, and payment workflows.</p>
      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-tabs">
          <button
            type="button"
            className={mode === "signin" ? "auth-tab auth-tab-active" : "auth-tab"}
            onClick={() => {
              setMode("signin");
              setErrors({});
              setMessage("");
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={mode === "signup" ? "auth-tab auth-tab-active" : "auth-tab"}
            onClick={() => {
              setMode("signup");
              setErrors({});
              setMessage("");
            }}
          >
            Sign Up
          </button>
        </div>

        {mode === "signup" && (
          <div className="auth-field-wrap">
            <label>Name</label>
            <input
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="Enter your full name"
            />
            {errors.name && <small className="auth-error">{errors.name}</small>}
          </div>
        )}

        <div className="auth-field-wrap">
          <label>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
            placeholder="name@example.com"
          />
          {errors.email && <small className="auth-error">{errors.email}</small>}
        </div>

        <div className="auth-field-wrap">
          <label>Department</label>
          <select
            value={form.department}
            onChange={(e) => updateField("department", e.target.value)}
          >
            {DEPARTMENTS.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
          {errors.department && <small className="auth-error">{errors.department}</small>}
        </div>

        <div className="auth-field-wrap">
          <label>Password</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => updateField("password", e.target.value)}
            placeholder="Enter password"
          />
          {errors.password && <small className="auth-error">{errors.password}</small>}
        </div>

        {mode === "signup" && (
          <div className="auth-field-wrap">
            <label>Confirm Password</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => updateField("confirmPassword", e.target.value)}
              placeholder="Re-enter password"
            />
            {errors.confirmPassword && <small className="auth-error">{errors.confirmPassword}</small>}
          </div>
        )}

        {message && <p className="auth-message">{message}</p>}

        <button type="submit" className="auth-submit">
          {mode === "signup" ? "Create Account" : "Login"}
        </button>
      </form>
    </div>
  );
}

export default AuthPage;
