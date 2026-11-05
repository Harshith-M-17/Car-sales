/**
 * Builds the indexes declared in the schemas. Run during deploys when
 * MONGODB_AUTO_INDEX=false.
 *
 *   npm run db:indexes            # create missing indexes (safe, additive)
 *   npm run db:indexes -- --drop  # also drop indexes no longer declared in code
 */
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { runScript } from './script-context';

void runScript('sync-indexes', async (app) => {
  const connection = app.get<Connection>(getConnectionToken());
  const drop = process.argv.includes('--drop');

  for (const model of Object.values(connection.models)) {
    const diff = await model.diffIndexes();
    if (drop) {
      const dropped = await model.syncIndexes();
      console.log(
        `${model.collection.name}: synced${dropped.length ? `, dropped ${dropped.join(', ')}` : ''}`,
      );
    } else {
      await model.createIndexes();
      const stale = diff.toDrop.length
        ? ` (not in code: ${diff.toDrop.join(', ')} — use --drop to remove)`
        : '';
      console.log(`${model.collection.name}: ${diff.toCreate.length} created${stale}`);
    }
  }
});
