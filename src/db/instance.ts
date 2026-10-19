import { AppDB } from './db';
import { Repo } from './repo';

/** The app's database and repository singletons. Tests construct their own instances. */
export const db = new AppDB();
export const repo = new Repo(db);
