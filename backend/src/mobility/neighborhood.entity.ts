import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('neighborhoods') // Asegúrate que tu tabla en SQLite se llama así
export class Neighborhood {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'float', nullable: true })
  latitude: number;

  @Column({ type: 'float', nullable: true })
  longitude: number;
}