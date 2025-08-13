import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  Index,
  Relation,
} from 'typeorm';

export enum TestStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('test_runs')
@Index(['testId'], { unique: true })
@Index(['status'])
@Index(['startedAt'])
export class TestRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'test_id', type: 'varchar', length: 255, unique: true })
  testId: string;

  @Column({ type: 'varchar', length: 100 })
  scenario: string;

  @Column({ type: 'int' })
  vus: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  duration: string | null;

  @Column({ type: 'int', nullable: true })
  iterations: number | null;

  @Column({ name: 'execution_mode', type: 'varchar', length: 50 })
  executionMode: string;

  @Column({ name: 'target_url', type: 'text' })
  targetUrl: string;

  @Column({ name: 'url_path', type: 'text' })
  urlPath: string;

  @Column({ name: 'http_method', type: 'varchar', length: 10 })
  httpMethod: string;

  @Column({ name: 'request_body', type: 'jsonb', nullable: true })
  requestBody: any;

  @Column({
    type: 'enum',
    enum: TestStatus,
    default: TestStatus.RUNNING,
  })
  status: TestStatus;

  @Column({ name: 'started_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne('TestResult', 'testRun')
  testResult: any;
}