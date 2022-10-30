import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Home from "./components/Home";
import Portfolio from "./components/Portfolio";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <div className="App">
            <Router>
                <Routes>
                    <Route path="/react/home" element={<Home />} />
                    <Route path="/react/portfolio" element={<Portfolio />} />
                    <Route path="/portfolio" element={<Home />} />
                    <Route path="/portfolio" element={<Home />} />
                    <Route path="/react/home" element={<Home />} />
                    <Route path="/react/home" element={<Home />} />
                    <Route
                        path="*"
                        element={<p>Oops, Page doesn't exists! Nothing Here</p>}
                    />
                </Routes>
            </Router>
        </div>
    </React.StrictMode>
);
