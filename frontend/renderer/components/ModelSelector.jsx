const MODELS = [
  { value: "llama3", label: "LLaMA 3 (recomendado)" },
  { value: "phi3", label: "Phi-3 Mini (rápido, instável)" },
];

export default function ModelSelector({ selectedModel, onChange, disabled }) {
  return (
    <div className="model-selector">
      <label htmlFor="model-select">Modelo:</label>
      <select
        id="model-select"
        value={selectedModel}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {MODELS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
    </div>
  );
}
