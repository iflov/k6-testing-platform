import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  JoinColumn,
  Index,
  OneToOne,
  Relation,
} from 'typeorm';

@Entity('test_results')
@Index(['testRunId'])
export class TestResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'test_run_id', type: 'uuid' })
  testRunId: string;

  @Column({ name: 'total_requests', type: 'int' })
  totalRequests: number;

  @Column({ name: 'failed_requests', type: 'int' })
  failedRequests: number;

  @Column({ name: 'avg_response_time', type: 'double precision' })
  avgResponseTime: number;

  @Column({ name: 'min_response_time', type: 'double precision' })
  minResponseTime: number;

  @Column({ name: 'max_response_time', type: 'double precision' })
  maxResponseTime: number;

  @Column({ name: 'p95_response_time', type: 'double precision' })
  p95ResponseTime: number;

  @Column({ name: 'p99_response_time', type: 'double precision' })
  p99ResponseTime: number;

  @Column({ name: 'avg_request_rate', type: 'double precision' })
  avgRequestRate: number;

  @Column({ name: 'error_rate', type: 'double precision' })
  errorRate: number;

  @Column({ name: 'data_received', type: 'bigint' })
  dataReceived: string; // TypeORM uses string for bigint

  @Column({ name: 'data_sent', type: 'bigint' })
  dataSent: string; // TypeORM uses string for bigint

  @Column({ name: 'max_vus', type: 'int' })
  maxVus: number;

  @Column({ name: 'avg_iteration_duration', type: 'double precision', nullable: true })
  avgIterationDuration: number | null;

  @Column({ name: 'metrics_json', type: 'jsonb', nullable: true })
  metricsJson: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToOne('TestRun', 'testResult')
  @JoinColumn({ name: 'test_run_id' })
  testRun: any;
}