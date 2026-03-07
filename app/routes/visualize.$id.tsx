import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { PUTER_WORKER_URL } from "lib/constants";

export default function VisualizeId() {
  const { id } = useParams();
  const location = useLocation();
  const {initialImage, name} = location.state || {};

  return (
    <section>
      <h1>{name || 'Untitled Project'}</h1>
      <div className="visualizer">
        {initialImage && (
          <div className="image-container">
            <h2>Source Image</h2>
            <img src={initialImage} alt="source"/>
          </div>
        )}
      </div>
    </section>
  );
}