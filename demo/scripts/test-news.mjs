import assert from 'node:assert/strict';
import {latestPublished, latestNews, isNews, newsDate} from '../src/lib/news.ts';
const now=Date.parse('2026-10-06T12:00:00Z');
const entries=Array.from({length:7},(_,i)=>({date:`2026-10-0${i+1}T00:00:00Z`,href:`/story-${i+1}/`}));
entries.push({date:'2026-10-06T01:00:00Z',href:'/draft/',draft:true},{date:'invalid',href:'/invalid/'});
assert.deepEqual(latestPublished(entries,now).map(x=>x.href),['/story-6/','/story-5/','/story-4/','/story-3/','/story-2/']);
assert.equal(newsDate('2017-09-15T00:00:00Z'),'September 15, 2017');
assert.equal(latestPublished(entries.slice(0,2),now).length,2);
assert.deepEqual(latestPublished([{date:'2026-10-01',href:'/z/'},{date:'2026-10-01',href:'/a/'}],now).map(x=>x.href),['/a/','/z/']);
console.log('news: latest-five order, draft/future/invalid exclusion, stable ties, fewer-than-five and publication-day checks passed');

const mixed = [{date:"2026-10-06",href:"/hospital/",tags:["news"]},{date:"2026-10-06",href:"/history/",tags:["history"]},{date:"2026-10-07",href:"/future-news/",tags:["news"]}];
assert.deepEqual(latestNews(mixed,now).map(x=>x.href),["/hospital/"]);
assert.deepEqual(mixed.filter(item=>!isNews(item)).map(x=>x.href),["/history/"]);
console.log("news: news-only selection and historical separation passed");
