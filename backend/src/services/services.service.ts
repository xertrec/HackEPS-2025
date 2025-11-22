import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ServicesService {
  async getSecurityLA(): Promise<{ area_name: string; score: number }[]> {
    try {
      const crimesUrl =
        'https://data.lacity.org/resource/2nrs-mtv8.json?$select=area_name,count(*) as crimes&$group=area_name&$order=crimes DESC';
      const accidentsUrl =
        'https://data.lacity.org/resource/d5tf-ez2w.json?$select=area_name,count(*) as accidents&$group=area_name&$order=accidents DESC';

      const [crimesResp, accidentsResp] = await Promise.all([
        axios.get(crimesUrl),
        axios.get(accidentsUrl),
      ]);

      const crimes = Array.isArray(crimesResp.data) ? crimesResp.data : [];
      const accidents = Array.isArray(accidentsResp.data) ? accidentsResp.data : [];

      const map = new Map<string, { area_name: string; crimes: number; accidents: number }>();

      const parseCount = (v: any) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      };

      for (const c of crimes) {
        const name = (c.area_name || '').trim();
        if (!name) continue;
        map.set(name, {
          area_name: name,
          crimes: parseCount(c.crimes),
          accidents: 0,
        });
      }

      for (const a of accidents) {
        const name = (a.area_name || '').trim();
        if (!name) continue;
        const entry = map.get(name);
        if (entry) {
          entry.accidents = parseCount(a.accidents);
        } else {
          map.set(name, {
            area_name: name,
            crimes: 0,
            accidents: parseCount(a.accidents),
          });
        }
      }

      const combined = Array.from(map.values()).map((e) => ({
        area_name: e.area_name,
        crimes: e.crimes,
        accidents: e.accidents,
        total: e.crimes + e.accidents,
      }));

      combined.sort((a, b) => b.total - a.total);
      const top20 = combined.slice(0, 20);

      const totals = top20.map((t) => t.total);
      const max = Math.max(...totals);
      const min = Math.min(...totals);

      const scoreFor = (value: number) => {
        if (max === min) return 50;
        const normalized = (value - min) / (max - min);
        return Math.round((1 - normalized) * 100);
      };

      // devolver solo area_name y score
      return top20.map((t) => ({
        area_name: t.area_name,
        score: scoreFor(t.total),
      }));
    } catch (error) {
      throw new HttpException('Error fetching LA security data', HttpStatus.BAD_GATEWAY);
    }
  }
}
