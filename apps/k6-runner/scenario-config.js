// K6 Runner용 시나리오 설정
// Control Panel의 scenario.ts와 동기화된 설정

const scenarioConfigs = {
  smoke: {
    id: "smoke",
    name: "Smoke Test",
    description: "Quick test to verify basic functionality",
    defaultVus: 1,
    defaultDuration: "1m",
    defaultIterations: 100,
    supportedModes: {
      duration: { enabled: true },
      iterations: { enabled: true },
      hybrid: { enabled: true },
    },
    useStages: false,
    rampPattern: "none",
  },
  load: {
    id: "load",
    name: "Load Test",
    description: "Constant load over time with ramp up/down",
    defaultVus: 20,
    defaultDuration: "5m",
    supportedModes: {
      duration: { enabled: true },
      iterations: { enabled: false },
      hybrid: { enabled: true },
    },
    useStages: true,
    rampPattern: "standard",
  },
  stress: {
    id: "stress",
    name: "Stress Test",
    description: "Gradually increase load to find breaking point",
    defaultVus: 50,
    defaultDuration: "10m",
    supportedModes: {
      duration: { enabled: true },
      iterations: { enabled: false },
      hybrid: { enabled: false },
    },
    useStages: true,
    rampPattern: "gradual",
  },
  spike: {
    id: "spike",
    name: "Spike Test",
    description: "Sudden increase in load to test system resilience",
    defaultVus: 100,
    defaultDuration: "5m",
    supportedModes: {
      duration: { enabled: true },
      iterations: { enabled: false },
      hybrid: { enabled: false },
    },
    useStages: true,
    rampPattern: "aggressive",
  },
  soak: {
    id: "soak",
    name: "Soak Test",
    description: "Extended duration test for memory leaks and stability",
    defaultVus: 30,
    defaultDuration: "30m",
    defaultIterations: 10000,
    supportedModes: {
      duration: { enabled: true },
      iterations: { enabled: true },
      hybrid: { enabled: true },
    },
    useStages: false,
    rampPattern: "none",
  },
  breakpoint: {
    id: "breakpoint",
    name: "Breakpoint Test",
    description: "Find system's maximum capacity",
    defaultVus: 100,
    defaultDuration: "20m",
    supportedModes: {
      duration: { enabled: true },
      iterations: { enabled: false },
      hybrid: { enabled: false },
    },
    useStages: true,
    rampPattern: "gradual",
  },
};

// 시나리오 설정 가져오기
function getScenarioConfig(scenarioId) {
  return scenarioConfigs[scenarioId] || scenarioConfigs.smoke;
}

// Ramp 패턴에 따른 stage 계산
function calculateStages(pattern, vus, totalSeconds) {
  const rampUpSeconds = Math.max(1, Math.floor(totalSeconds * 0.15));
  const rampDownSeconds = Math.max(1, Math.floor(totalSeconds * 0.15));
  const steadySeconds = totalSeconds - rampUpSeconds - rampDownSeconds;

  switch (pattern) {
    case "none":
      return null; // stages 사용 안함
    
    case "standard":
      // 15% ramp up, 70% steady, 15% ramp down
      return [
        { duration: `${rampUpSeconds}s`, target: vus },
        { duration: `${steadySeconds}s`, target: vus },
        { duration: `${rampDownSeconds}s`, target: 0 },
      ];
    
    case "aggressive":
      // Spike 패턴: 급격한 증가와 감소
      const spikeUpSeconds = Math.max(1, Math.floor(totalSeconds * 0.05));
      const spikeHoldSeconds = Math.floor(totalSeconds * 0.3);
      const normalSeconds = Math.floor(totalSeconds * 0.3);
      const spikeDownSeconds = Math.max(1, Math.floor(totalSeconds * 0.05));
      
      return [
        { duration: `${normalSeconds}s`, target: Math.floor(vus * 0.2) },
        { duration: `${spikeUpSeconds}s`, target: vus }, // 급증
        { duration: `${spikeHoldSeconds}s`, target: vus },
        { duration: `${spikeDownSeconds}s`, target: Math.floor(vus * 0.2) }, // 급감
        { duration: `${normalSeconds}s`, target: Math.floor(vus * 0.2) },
      ];
    
    case "gradual":
      // Stress/Breakpoint 패턴: 단계적 증가
      const steps = 4;
      const stepDuration = Math.floor(totalSeconds / (steps + 1));
      const stages = [];
      
      for (let i = 1; i <= steps; i++) {
        stages.push({
          duration: `${stepDuration}s`,
          target: Math.floor((vus * i) / steps),
        });
      }
      stages.push({ duration: `${stepDuration}s`, target: 0 });
      
      return stages;
    
    default:
      return null;
  }
}

module.exports = {
  scenarioConfigs,
  getScenarioConfig,
  calculateStages,
};