-- CreateTable
CREATE TABLE "NetworkGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NetworkGroupMember" (
    "groupId" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,

    PRIMARY KEY ("groupId", "networkId"),
    CONSTRAINT "NetworkGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "NetworkGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NetworkGroupMember_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "Network" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
