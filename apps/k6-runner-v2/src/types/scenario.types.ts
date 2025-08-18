export interface Scenario {
  id: string;
  name: string;
  description: string;
  defaultVus: number;
  defaultDuration: string;
  defaultIterations: number;
  supportedModes: {
    duration: { enabled: boolean };
    iterations: { enabled: boolean };
    hybrid: { enabled: boolean };
  };
  useStages: boolean;
  rampPattern: string;
}
