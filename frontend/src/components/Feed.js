import React from "react";
import PostCard from './PostCard';

export default function Feed({ posts, single=false }) {
  return (
    <div className={single ? "feed single" : "feed"}>
      {posts.map(p => (
        <PostCard key={p._id || p.id} post={p} />
      ))}
    </div>
  );
}
